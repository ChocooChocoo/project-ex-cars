<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Catalogue\ShowroomController;
use App\Http\Controllers\Controller;
use App\Models\FieldCase;
use App\Models\Installment;
use App\Models\InstallmentAccount;
use App\Models\PaymentRecord;
use App\Models\PaymentTerm;
use App\Models\PurchaseDetail;
use App\Models\SaleHandover;
use App\Models\SellDetail;
use App\Models\Transaction;
use App\Models\TransactionDocument;
use App\Models\TransactionStatusHistory;
use App\Models\Vehicle;
use App\Models\VehicleInspection;
use App\Models\ViewingArrangement;
use App\Services\FileService;
use App\Services\Trading\Trading;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/** Staff transaction pages (was (staff)/transactions/page.tsx and [id]/page.tsx). Route group: TRANSACTION_VIEWERS. */
class StaffTradingReadController extends Controller
{
    /** GET /staff/field-workers: the guarded directory (list_field_case_workers). */
    public function fieldWorkers(): JsonResponse
    {
        return response()->json(['workers' => Trading::fieldWorkers()->map(fn ($w) => (array) $w)->values()]);
    }

    /** GET /staff/transactions?state=: the rows the page turns into its table and KPI strip. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        // ponytail: kept from the old page (it ran checkAndNotifyOverdueReviews on render); drop once the Phase 6 cron runs trading:deadlines.
        \App\Services\Trading\Deadlines::notify();
        $query = Transaction::query()->orderByDesc('updated_at');
        if ($user->hasRole('sales_manager')) {
            $query->where('transaction_kind', 'buy');
        }
        $state = $request->query('state');
        if (in_array($state, ['pending', 'under_review', 'approved', 'rejected', 'completed', 'cancelled'], true)) {
            $query->where('current_state', $state);
        }
        // Same record rules as the Supabase RLS the page relied on (TransactionPolicy::view).
        $all = $query->get()->filter(fn ($t) => Gate::forUser($user)->allows('view', $t))->values();
        $ids = $all->pluck('id');
        $vehicles = Vehicle::query()->whereIn('id', $all->pluck('vehicle_id')->filter())->get(['id', 'make', 'model', 'year'])->keyBy('id');
        $names = DB::table('profiles')->whereIn('id', $all->pluck('customer_id'))->pluck('full_name', 'id');
        $purchases = PurchaseDetail::query()->whereIn('transaction_id', $ids)->get()->keyBy('transaction_id');
        $accounts = InstallmentAccount::query()->whereIn('purchase_transaction_id', $ids)->get(['id', 'purchase_transaction_id'])->keyBy('purchase_transaction_id');
        $installments = DB::table('installments')->whereIn('account_id', $accounts->pluck('id'))->get(['account_id', 'state'])->groupBy('account_id');

        return response()->json(['role' => $user->role()?->value, 'transactions' => $all->map(fn ($t) => ApiRow::of($t) + [
            'vehicles' => ApiRow::of($vehicles[$t->vehicle_id] ?? null, ['make', 'model', 'year']),
            'profiles' => isset($names[$t->customer_id]) ? ['full_name' => $names[$t->customer_id]] : null,
            'purchase_details' => ApiRow::of($purchases[$t->id] ?? null),
            'installment_accounts' => isset($accounts[$t->id])
                ? ['installments' => ($installments[$accounts[$t->id]->id] ?? collect())->map(fn ($i) => ['state' => $i->state])->values()] : null,
        ])]);
    }

    /** GET /staff/transactions/{id}: every prop of StaffTransactionDetail. */
    public function show(Request $request, FileService $files, string $id): JsonResponse
    {
        abort_unless(Str::isUuid($id), 404);
        $user = $request->user();
        $tx = Transaction::query()->findOrFail($id);
        abort_unless(Gate::forUser($user)->allows('view', $tx), 404, 'Resource not found.');
        $vehicle = $tx->vehicle_id ? Vehicle::query()->find($tx->vehicle_id) : null;
        $profile = DB::table('profiles')->where('id', $tx->customer_id)->first(['full_name', 'region_code']);
        $purchase = PurchaseDetail::query()->where('transaction_id', $id)->first();
        $sell = SellDetail::query()->where('transaction_id', $id)->first();
        $transaction = ApiRow::of($tx) + [
            'vehicles' => ApiRow::of($vehicle, ['make', 'model', 'year', 'stock_code', 'listing_state', 'condition', 'mileage', 'financing_markup_pct']),
            'profiles' => $profile ? (array) $profile : null,
            'purchase_details' => ApiRow::of($purchase),
            'sell_details' => ApiRow::of($sell),
            'sale_handovers' => ApiRow::of(SaleHandover::query()->find($id)),
        ];
        // T03 HA2: the receipt photo is signed like a document; the path never reaches the page.
        $payments = PaymentRecord::query()->where('transaction_id', $id)->orderByDesc('settlement_date')->get()->map(function ($p) use ($files) {
            $row = ApiRow::of($p);
            $path = $row['proof_path'] ?? null;
            unset($row['proof_path']);

            return $row + ['proof_url' => $files->signedUrl('transaction-documents', $path, 3600)];
        })->values();
        $account = InstallmentAccount::query()->where('purchase_transaction_id', $id)->first();
        $workers = Trading::fieldWorkers();
        $pick = fn (string $role) => $workers->where('role', $role)->map(fn ($w) => ['id' => $w->account_id, 'full_name' => $w->full_name])->values();
        $informants = $pick('confidential_informant');
        $headSecurity = $pick('head_security');
        $mechanics = $pick('mechanic');
        $buy = $tx->transaction_kind === 'buy';

        $carBuyers = [];
        if ($buy && $tx->vehicle_id) {
            $rows = Transaction::query()->where('vehicle_id', $tx->vehicle_id)->where('transaction_kind', 'buy')
                ->whereNotIn('current_state', Trading::TERMINAL)->orderBy('opened_at')->get();
            $buyerNames = DB::table('profiles')->whereIn('id', $rows->pluck('customer_id'))->pluck('full_name', 'id');
            $carBuyers = $rows->map(fn ($r) => ApiRow::of($r, ['id', 'current_state', 'queue_state', 'flow_status', 'flag', 'review_due_at', 'opened_at'])
                + ['profiles' => ['full_name' => $buyerNames[$r->customer_id] ?? null]])->values();
        }
        $case = fn (string $kind, ?array $only = null) => ApiRow::of(FieldCase::query()->where('transaction_id', $id)->where('case_kind', $kind)->where('state', '!=', 'cancelled')->first(), $only);
        $isDelivery = $buy && $purchase?->arrangement_kind === 'delivery';
        $isFinancing = $buy && $purchase?->payment_method === 'financing';
        $isMeetup = $buy && $purchase?->arrangement_kind === 'meetup';
        $isSell = $tx->transaction_kind === 'sell';
        $thread = DB::table('inquiries')->where('transaction_id', $id)->value('id');

        $financing = null;
        if ($isFinancing) {
            $recovery = DB::table('field_cases')->where('transaction_id', $id)->where('case_kind', 'recovery')->where('state', '!=', 'cancelled')->pluck('state');
            $own = $vehicle?->financing_markup_pct;
            $financing = [
                'hasRecoveryCase' => $recovery->isNotEmpty(), 'recoveryInProgress' => $recovery->contains('in_progress'), 'threadId' => $thread,
                'markupPct' => $own !== null && (float) $own >= 0 ? (float) $own : ShowroomController::globalMarkupPct(),
            ];
        }

        $sellFlow = null;
        if ($isSell) {
            $fieldCase = FieldCase::query()->where('transaction_id', $id)->where('case_kind', 'acquisition')->first();
            $fund = DB::table('disbursement_requests')->where('purchase_transaction_id', $id)->where('status', '!=', 'rejected')->orderByDesc('created_at')
                ->first(['id', 'status', 'amount_cents', 'purpose', 'requested_by', 'returned_cents', 'returned_at', 'return_confirmed_at']);
            $expenses = $fieldCase ? DB::table('field_case_expenses')->where('field_case_id', $fieldCase->id)->orderBy('submitted_at')
                ->get(['id', 'amount', 'description', 'submitted_at', 'reimbursed_at']) : collect();
            $iso = fn ($v) => $v ? \Carbon\CarbonImmutable::parse($v, 'UTC')->toJSON() : null;
            $sellFlow = [
                'proposals' => ApiRow::list(\App\Models\VehiclePriceProposal::query()->where('transaction_id', $id)->orderByDesc('created_at')
                    ->get(['id', 'proposal_kind', 'proposed_amount', 'decision', 'notes', 'created_at'])),
                'fieldCase' => ApiRow::of($fieldCase),
                'issueReport' => ApiRow::of(\App\Models\InspectionIssueReport::query()->where('transaction_id', $id)->first()),
                // SH-7 / SH-3: the part-by-part inspection, with costs and private photo links, for the Marketing
                // Specialist now and the Head Accountant from Phase 8.
                'inspection' => $fieldCase ? VehicleInspection::pack($fieldCase->id, $id) : null,
                'expenses' => $expenses->map(fn ($e) => ['id' => $e->id, 'amount' => (float) $e->amount, 'description' => $e->description,
                    'submitted_at' => $iso($e->submitted_at), 'reimbursed_at' => $iso($e->reimbursed_at), 'field_cases' => ['transaction_id' => $id]])->values(),
                'threadId' => $thread,
                'mechanics' => $mechanics,
                'fund' => $fund ? array_merge((array) $fund, [
                    'amount_cents' => (int) $fund->amount_cents, 'returned_cents' => $fund->returned_cents === null ? null : (int) $fund->returned_cents,
                    'returned_at' => $iso($fund->returned_at), 'return_confirmed_at' => $iso($fund->return_confirmed_at),
                ]) : null,
                'fundIsMine' => (bool) ($fund && $fund->requested_by === $user->id),
                // SN-3: whether the bought car's OR/CR/Deed photos were already sent to the Confidential Informant.
                'papersCustody' => $tx->vehicle_id ? DB::table('vehicle_document_items')->where('vehicle_id', $tx->vehicle_id)
                    ->whereNotNull('custody_state')->value('custody_state') : null,
            ];
        }

        $conditionIds = collect(is_array($sell?->condition_items) ? $sell->condition_items : json_decode((string) $sell?->getRawOriginal('condition_items'), true) ?? [])
            ->filter(fn ($v) => is_string($v) && Str::isUuid($v))->values();
        $nameMap = $conditionIds->isEmpty() ? (object) [] : DB::table('inspection_checklist_nodes')->whereIn('id', $conditionIds)->pluck('name', 'id');

        return response()->json([
            'transaction' => $transaction,
            // BC-8: the same rule the approval gate enforces, so the page can disable Approve with one source of truth.
            'verifiedPrerequisites' => $buy ? StaffTransactionController::verifiedPrerequisites($id) : null,
            'history' => ApiRow::list(TransactionStatusHistory::query()->where('transaction_id', $id)->orderBy('changed_at')->get()),
            'documents' => CustomerTradingReadController::signedDocuments(TransactionDocument::query()->where('transaction_id', $id)->orderByDesc('upload_date')->get()),
            'payments' => $payments,
            'installmentAccount' => $account ? ApiRow::of($account) + ['installments' => ApiRow::list(Installment::query()->where('account_id', $account->id)->orderBy('sequence_no')->get())] : null,
            'paymentTerms' => ApiRow::of(PaymentTerm::query()->where('purchase_transaction_id', $id)->first()),
            'viewingArrangements' => ApiRow::list(ViewingArrangement::query()->where('purchase_transaction_id', $id)->orderByDesc('created_at')->get()),
            'userRole' => $user->role()?->value,
            'informants' => $informants,
            'checklistNameMap' => $nameMap,
            'carBuyers' => $carBuyers,
            'financing' => $financing,
            'meetup' => $isMeetup ? ['fieldCase' => $case('buyer_meetup', ['id', 'state', 'ci_received_at', 'mechanic_received_at']), 'informants' => $informants, 'mechanics' => $mechanics] : null,
            'headSecurity' => $headSecurity,
            'delivery' => $isDelivery ? [
                'fieldCase' => $case('delivery', ['id', 'state', 'delivery_status', 'delay_note', 'expected_arrival', 'last_lat', 'last_lng', 'last_located_at']),
                'team' => ['informants' => $informants, 'headSecurity' => $headSecurity],
            ] : null,
            'sellFlow' => $sellFlow,
        ]);
    }
}
