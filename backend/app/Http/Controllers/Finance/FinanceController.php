<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Services\Finance\Disbursements;
use App\Services\Finance\Ledger;
use App\Services\Finance\Money;
use App\Services\Trading\Trading;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Finance page writes (was src/app/(staff)/finance/actions.ts): ledger entries, disbursement requests and their
 * release chain, car-purchase funds, the seller payment and field-expense reimbursement. Amounts are integer
 * centavos (`amount_cents` columns). The actor always comes from the session.
 */
class FinanceController extends Controller
{
    private const NEXT = ['draft' => 'approved', 'submitted' => 'approved', 'approved' => 'released', 'released' => 'received', 'received' => 'paid'];

    private function role(Request $request): string
    {
        return (string) $request->user()->role()?->value;
    }

    private function allow(Request $request, array $roles, string $message): void
    {
        abort_unless(in_array($this->role($request), $roles, true), 403, $message);
    }

    public function recordEntry(Request $request): JsonResponse
    {
        $this->allow($request, ['ceo', 'head_accountant', 'account_manager'], 'Not authorized to record financial entries');
        $data = $request->validate([
            'entry_kind' => ['required', 'in:revenue,expense,disbursement,adjustment'],
            'amount_cents' => ['required', 'integer', 'min:0'],
            'transaction_id' => ['nullable', 'uuid'],
            'field_case_id' => ['nullable', 'uuid'],
            'description' => ['required', 'string', 'max:500'],
        ], ['amount_cents.min' => 'Amount cannot be negative.', 'description.required' => 'Description is required.', '*' => 'Invalid entry.']);
        DB::table('financial_entries')->insert(['id' => (string) Str::uuid(), 'entry_kind' => $data['entry_kind'], 'amount_cents' => (int) $data['amount_cents'],
            'transaction_id' => $data['transaction_id'] ?? null, 'field_case_id' => $data['field_case_id'] ?? null, 'description' => $data['description'],
            'recorded_by' => $request->user()->id, 'recorded_at' => now(), 'created_at' => now()]);

        return response()->json(['success' => true]);
    }

    public function verifyEntry(Request $request): JsonResponse
    {
        $this->allow($request, ['ceo', 'head_accountant'], 'Not authorized to verify entries');
        $id = (string) $request->input('entry_id');
        abort_unless(Str::isUuid($id), 404, 'Entry not found.');
        // Verified once: a repeat keeps the first verifier.
        DB::table('financial_entries')->where('id', $id)->whereNull('verified_by')->update(['verified_by' => $request->user()->id, 'verified_at' => now()]);

        return response()->json(['success' => true]);
    }

    public function createDisbursement(Request $request): JsonResponse
    {
        $this->allow($request, ['ceo', 'account_manager', 'confidential_informant'], 'Not authorized to create disbursement requests');
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'amount_cents' => ['required', 'integer', 'min:1'],
            'purpose' => ['required', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], ['title.required' => 'Title is required.', 'amount_cents.min' => 'Amount must be greater than zero.', 'purpose.required' => 'Purpose is required.', '*' => 'Invalid request.']);
        DB::transaction(function () use ($request, $data) {
            $id = (string) Str::uuid();
            DB::table('disbursement_requests')->insert(['id' => $id, 'title' => $data['title'], 'amount_cents' => (int) $data['amount_cents'], 'purpose' => $data['purpose'],
                'status' => 'draft', 'requested_by' => $request->user()->id, 'notes' => ($data['notes'] ?? '') ?: null, 'created_at' => now(), 'updated_at' => now()]);
            Disbursements::event($id, 'submitted', $request->user()->id, 'Request created.');
        });

        return response()->json(['success' => true]);
    }

    /**
     * T10 Selling: the person who pays the seller requests the agreed price (GCE Visit: the Marketing Specialist;
     * Meet Halfway: the assigned CI, price plus travel). A buy keeps the CEO/Account Manager draft request.
     */
    public function requestPurchaseFunds(Request $request): JsonResponse
    {
        $role = $this->role($request);
        $this->allow($request, ['ceo', 'account_manager', 'marketing_specialist', 'confidential_informant'], 'Not authorized to request purchase funds');
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'],
            'amount_cents' => ['nullable', 'integer', 'min:1'],
            'travel_cents' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], ['*' => 'Invalid fund request.']);
        $userId = $request->user()->id;

        try {
            Trading::run(function () use ($data, $role, $userId) {
                $tx = Trading::lockTx($data['transaction_id']);
                abort_unless($tx, 404, 'Transaction not found.');
                if ($tx->transaction_kind === 'sell') {
                    $sell = DB::table('sell_details')->where('transaction_id', $tx->id)->first(['agreed_price', 'meetup_method']);
                    abort_if($tx->current_state !== 'approved' || $sell?->agreed_price === null, 422, 'Request the funds after the price is agreed with the seller.');
                    $case = DB::table('field_cases')->where('transaction_id', $tx->id)->where('case_kind', 'acquisition')->where('state', '!=', 'cancelled')
                        ->first(['id', 'assigned_confidential_informant']);
                    abort_unless($case, 422, 'Create the field case first.');
                    $halfway = $sell->meetup_method !== 'gce_visit';
                    abort_if($halfway && ($role !== 'confidential_informant' || $case->assigned_confidential_informant !== $userId), 403,
                        'On a Meet Halfway, the assigned Confidential Informant requests the funds.');
                    abort_if(! $halfway && $role !== 'marketing_specialist', 403, 'On a GCE Visit, the Marketing Specialist requests the funds.');
                    $price = Money::cents($sell->agreed_price);
                    $travel = $halfway ? (int) ($data['travel_cents'] ?? 0) : 0;
                    $peso = fn (int $c) => '₱'.Money::peso($c);
                    $row = ['amount_cents' => $price + $travel, 'field_case_id' => $case->id, 'status' => 'submitted', 'purpose' => $halfway
                        ? "Car payment {$peso($price)} plus estimated travel {$peso($travel)} (Meet Halfway)"
                        : "Car payment {$peso($price)} (GCE Visit)"];
                } else {
                    abort_unless(in_array($role, ['ceo', 'account_manager'], true), 403, 'Not authorized to request purchase funds');
                    abort_unless(! empty($data['amount_cents']), 422, 'Enter the amount.');
                    $row = ['amount_cents' => (int) $data['amount_cents'], 'status' => 'draft', 'purpose' => "Release of funds for car purchase (transaction {$tx->id})"];
                }
                $id = (string) Str::uuid();
                DB::table('disbursement_requests')->insert($row + ['id' => $id, 'title' => 'Car purchase fund', 'requested_by' => $userId,
                    'notes' => ($data['notes'] ?? '') ?: null, 'purchase_transaction_id' => $tx->id, 'created_at' => now(), 'updated_at' => now()]);
                Disbursements::event($id, 'submitted', $userId, 'Purchase fund request created — awaiting Head Accountant release.');
                Trading::notify(['role' => 'head_accountant'], 'purchase_funds_requested', 'Car purchase funds requested', "{$row['purpose']}. Review and release it in Finance.", $tx->id);
            });
        } catch (UniqueConstraintViolationException) {
            abort(409, 'The funds for this car are already requested.');
        }

        return response()->json(['success' => true]);
    }

    /** T10: the fund requester (or the Head Accountant) records the seller paid, once the car is cleared. */
    public function recordSellerPaid(Request $request): JsonResponse
    {
        $id = (string) $request->input('disbursement_id');
        abort_unless(Str::isUuid($id), 404, 'Fund request not found.');
        Trading::run(fn () => Disbursements::completePurchase($id, $request->user()->id, $this->role($request) === 'head_accountant', 'Seller paid by the fund requester'));

        return response()->json(['success' => true]);
    }

    /** The release chain draft/submitted → approved → released → received → paid, or a rejection. */
    public function advance(Request $request): JsonResponse
    {
        $role = $this->role($request);
        $this->allow($request, ['ceo', 'head_accountant'], 'Not authorized to advance disbursements');
        $data = $request->validate([
            'disbursement_id' => ['required', 'uuid'],
            'event_kind' => ['required', 'in:submitted,approved,rejected,released,received,paid'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], ['*' => 'Invalid action.']);
        $kind = $data['event_kind'];
        $actor = $request->user()->id;

        Trading::run(function () use ($data, $kind, $role, $actor) {
            $request = DB::table('disbursement_requests')->where('id', $data['disbursement_id'])->first(['status', 'purchase_transaction_id']);
            abort_unless($request, 404, 'Disbursement not found.');
            abort_if($request->purchase_transaction_id && $role !== 'head_accountant', 403, 'Only the Head Accountant can approve or release car-purchase funds.');
            if ($kind === 'paid' && $request->purchase_transaction_id) {
                Disbursements::completePurchase($data['disbursement_id'], $actor, true, $data['notes'] ?? null);

                return;
            }
            $locked = DB::table('disbursement_requests')->where('id', $data['disbursement_id'])->lockForUpdate()->first();
            if ($kind === 'rejected') {
                abort_unless(in_array($locked->status, ['draft', 'submitted'], true), 409, 'Only draft or submitted requests can be rejected.');
            } else {
                abort_unless((self::NEXT[$locked->status] ?? null) === $kind, 409, "Cannot move from {$locked->status} to {$kind}.");
            }
            $by = ['approved' => 'approved_by', 'released' => 'released_by', 'received' => 'received_by'][$kind] ?? null;
            // BH-4: the rejection reason travels with the request so its requester reads why it was refused.
            $reason = trim((string) ($data['notes'] ?? ''));
            DB::table('disbursement_requests')->where('id', $locked->id)->update(['status' => $kind, 'updated_at' => now()]
                + ($by ? [$by => $actor] : []) + ($kind === 'rejected' ? ['rejection_reason' => $reason !== '' ? $reason : null] : []));
            Disbursements::event($locked->id, $kind, $actor, $data['notes'] ?? null);
            // SN-10: releasing the cash is the outflow; the description is the request's own reason. One entry per
            // request however often the release is retried — `completePurchase` posts nothing, it only spends it.
            if ($kind === 'released') {
                Ledger::post('disbursement', (int) $locked->amount_cents, "Funds released: {$locked->title}. {$locked->purpose}",
                    'release:'.$locked->id, (string) $actor, $locked->purchase_transaction_id, $locked->field_case_id);
            }
            // The reconditioning ledger follows the same step (the vehicle page reads the fund request's own state).
            $fundState = match (true) {
                $kind === 'approved' => 'approved',
                in_array($kind, ['released', 'received', 'paid'], true) => 'released',
                $kind === 'rejected' => 'rejected',
                default => null,
            };
            if ($fundState) {
                DB::table('reconditioning_fund_requests')->where('disbursement_id', $locked->id)->update(['state' => $fundState, 'updated_at' => now()]);
            }
        });

        return response()->json(['success' => true]);
    }

    /** Selling step 13: a field expense is reimbursed once the car GCE bought is sold on. */
    public function markExpenseReimbursed(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'head_accountant', 403, 'Only the Head Accountant can record reimbursements.');
        $id = (string) $request->input('expense_id');
        abort_unless(Str::isUuid($id), 422, 'Invalid expense.');

        DB::transaction(function () use ($request, $id) {
            $expense = DB::table('field_case_expenses as e')->leftJoin('field_cases as f', 'f.id', '=', 'e.field_case_id')->leftJoin('vehicles as v', 'v.id', '=', 'f.vehicle_id')
                ->where('e.id', $id)->lockForUpdate()->first(['e.id', 'e.amount', 'e.description', 'e.reimbursed_at', 'e.field_case_id', 'f.transaction_id', 'v.listing_state']);
            abort_unless($expense, 404, 'Expense not found.');
            abort_if($expense->reimbursed_at, 409, 'This expense is already reimbursed.');
            abort_unless($expense->listing_state === 'sold', 422, 'Reimburse only after the vehicle is sold.');
            DB::table('field_case_expenses')->where('id', $id)->whereNull('reimbursed_at')->update(['reimbursed_at' => now(), 'reimbursed_by' => $request->user()->id]);
            // SN-10: reimbursed cash leaves the drawer; the itemised expense gives it its description.
            Ledger::post('expense', Money::cents($expense->amount), 'Field expense reimbursed: '.($expense->description ?: 'field expense'),
                'expense:'.$expense->id, (string) $request->user()->id, $expense->transaction_id, $expense->field_case_id);
        });

        return response()->json(['success' => true]);
    }
}
