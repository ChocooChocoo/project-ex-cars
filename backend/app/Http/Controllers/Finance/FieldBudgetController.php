<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Finance\Ledger;
use App\Services\Finance\Money;
use App\Services\Trading\Trading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * T10 field budgets (was src/app/(staff)/field-cases/budget-actions.ts). The Confidential Informant assigned to a
 * delivery or buyer meet-up asks the Head Accountant for travel money, records the unused cash returned, and the
 * Head Accountant confirms the return. Notices go out after the commit.
 */
class FieldBudgetController extends Controller
{
    private const CASE_LABELS = ['delivery' => 'Delivery', 'buyer_meetup' => 'Buyer meet-up', 'acquisition' => 'Meet Halfway purchase'];

    private const RELEASED = ['released', 'received', 'paid'];

    /**
     * BH-5: what a field budget covers, as the checklist the Confidential Informant ticks. Mirrors
     * FIELD_EXPENSE_CATEGORIES in src/lib/transactions/field-budget.ts; the stored `purpose` is the joined labels so
     * every existing finance reader keeps working.
     */
    public const EXPENSE_CATEGORIES = [
        'fuel' => 'Fuel',
        'tolls' => 'Tolls',
        'parking' => 'Parking fee',
        'meals' => 'Meals',
        'transport' => 'Transportation fare',
        'other' => 'Other',
    ];

    /** @param  list<string>  $categories */
    public static function purposeFromCategories(array $categories, string $other = ''): string
    {
        $other = trim($other);
        $labels = [];
        foreach (array_keys(self::EXPENSE_CATEGORIES) as $key) {
            if (! in_array($key, $categories, true)) {
                continue;
            }
            $labels[] = $key === 'other' && $other !== '' ? "Other: {$other}" : self::EXPENSE_CATEGORIES[$key];
        }

        return implode(', ', $labels);
    }

    /** The assigned informant, or (for a return) whoever requested the live budget. */
    private static function fieldCase(mixed $id, User $user, bool $requesterMayAct = false): object
    {
        abort_unless(is_string($id) && Str::isUuid($id), 422, 'Invalid field case.');
        $case = DB::table('field_cases')->where('id', $id)->first(['id', 'transaction_id', 'case_kind', 'state', 'assigned_confidential_informant']);
        abort_unless($case && isset(self::CASE_LABELS[$case->case_kind]), 404, 'Field case not found.');
        $informant = $user->hasRole('confidential_informant') && $case->assigned_confidential_informant === $user->id;
        $requester = $requesterMayAct && DB::table('disbursement_requests')->where('field_case_id', $case->id)->where('requested_by', $user->id)->where('status', '!=', 'rejected')->exists();
        abort_unless($informant || $requester, 403, 'Only the assigned Confidential Informant can do this.');

        return $case;
    }

    public function request(Request $request): JsonResponse
    {
        $user = $request->user();
        $case = self::fieldCase($request->input('field_case_id'), $user);
        abort_if(in_array($case->state, ['completed', 'cancelled'], true), 409, 'This field case is closed.');
        abort_if($case->case_kind === 'acquisition', 422, 'On a seller meet-up, request the car payment and travel together as purchase funds.');
        $amount = $request->input('amount');
        abort_unless(is_numeric($amount) && (float) $amount > 0, 422, 'Enter the estimated expenses.');
        // BH-5: the purpose is the ticked categories, not free text. A free-text `purpose` still validates so the
        // older clients keep working, but a request without categories is refused.
        $categories = $request->input('categories');
        if (is_string($categories)) {
            $categories = [$categories];
        }
        abort_unless(is_array($categories) && $categories !== [], 422, 'Say what the budget covers.');
        $categories = array_values(array_unique($categories));
        abort_if(collect($categories)->contains(fn ($c) => ! is_string($c) || ! array_key_exists($c, self::EXPENSE_CATEGORIES)), 422, 'Say what the budget covers.');
        $other = trim((string) $request->input('other'));
        abort_if(in_array('other', $categories, true) && $other === '', 422, 'Say what the other expense is.');
        abort_if(mb_strlen($other) > 100, 422, 'Invalid budget request.');
        $purpose = self::purposeFromCategories($categories, $other);
        abort_if($purpose === '', 422, 'Say what the budget covers.');
        $cents = Money::cents($amount);
        $label = self::CASE_LABELS[$case->case_kind];

        try {
            Trading::run(function () use ($user, $case, $cents, $purpose, $label) {
                $id = (string) Str::uuid();
                DB::table('disbursement_requests')->insert(['id' => $id, 'title' => "{$label} budget", 'amount_cents' => $cents, 'purpose' => $purpose,
                    'status' => 'submitted', 'requested_by' => $user->id, 'field_case_id' => $case->id, 'created_at' => now(), 'updated_at' => now()]);
                DB::table('disbursement_events')->insert(['id' => (string) Str::uuid(), 'disbursement_id' => $id, 'event_kind' => 'submitted', 'actor_id' => $user->id,
                    'notes' => 'Field budget requested.', 'created_at' => now()]);
                Trading::notify(['role' => 'head_accountant'], 'field_budget_requested', "{$label} budget requested",
                    'The Confidential Informant requests '.Money::currency($cents).' for estimated expenses. Review it in Finance.', (string) $case->transaction_id);
            });
        } catch (\Throwable $e) {
            abort_if(Trading::isUnique($e, 'disbursement_requests_one_live_field_budget'), 409, 'This field case already has a budget request.');
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    /**
     * BH-3 / SN-2 / SH-11: the Confidential Informant records what came back. Zero is a real answer — the receipts
     * used the whole budget — so it is confirmed on the spot (`return_confirmed_at` set, `return_confirmed_by` null)
     * and no Head Accountant task is created for it.
     */
    public function recordReturn(Request $request): JsonResponse
    {
        $case = self::fieldCase($request->input('field_case_id'), $request->user(), requesterMayAct: true);
        $returned = $request->input('returned');
        abort_unless(is_numeric($returned), 422, 'Enter the amount returned.');
        abort_if((float) $returned < 0, 422, 'The amount cannot be negative.');
        $cents = Money::cents($returned);

        Trading::run(function () use ($case, $cents) {
            $budget = DB::table('disbursement_requests')->where('field_case_id', $case->id)->where('status', '!=', 'rejected')->lockForUpdate()->first();
            abort_unless($budget && in_array($budget->status, self::RELEASED, true), 409, 'The Head Accountant has not released a budget yet.');
            abort_if($budget->returned_at !== null, 409, 'The return is already recorded.');
            abort_if($cents > (int) $budget->amount_cents, 422, 'You cannot return more than was released.');
            $now = now();
            if ($cents === 0) {
                DB::table('disbursement_requests')->where('id', $budget->id)->update([
                    'returned_cents' => 0, 'returned_at' => $now, 'return_confirmed_at' => $now, 'updated_at' => $now,
                ]);

                return;
            }
            DB::table('disbursement_requests')->where('id', $budget->id)->update(['returned_cents' => $cents, 'returned_at' => $now, 'updated_at' => $now]);
            Trading::notify(['role' => 'head_accountant'], 'field_budget_returned', 'Field budget excess returned',
                Money::currency($cents).' of released funds was returned. Confirm you received it in Finance.', (string) $case->transaction_id);
        });

        return response()->json(['success' => true]);
    }

    public function confirmReturn(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->hasRole('head_accountant'), 403, 'Only the Head Accountant confirms returns.');
        $id = $request->input('disbursement_id');
        abort_unless(is_string($id) && Str::isUuid($id), 404, 'Budget not found.');
        $updated = DB::table('disbursement_requests')->where('id', $id)->whereNotNull('returned_at')->whereNull('return_confirmed_at')
            ->update(['return_confirmed_by' => $user->id, 'return_confirmed_at' => now(), 'updated_at' => now()]);
        abort_unless($updated === 1, 409, 'No unconfirmed return on this budget.');

        // SN-10: the confirmed excess is cash back in the drawer. Posted only by the confirmation that won the
        // update above, and keyed to the budget, so a retried confirmation cannot post a second time.
        $budget = DB::table('disbursement_requests')->where('id', $id)->first(['title', 'returned_cents', 'purchase_transaction_id', 'field_case_id']);
        if ($budget && (int) $budget->returned_cents > 0) {
            Ledger::post('adjustment', (int) $budget->returned_cents, "Excess returned: {$budget->title}",
                'return:'.$id, (string) $user->id, $budget->purchase_transaction_id, $budget->field_case_id);
        }

        return response()->json(['success' => true]);
    }
}
