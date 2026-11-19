<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Models\User;
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
        $purpose = trim((string) $request->input('purpose'));
        abort_if($purpose === '', 422, 'Say what the budget covers.');
        abort_if(mb_strlen($purpose) > 1000, 422, 'Invalid budget request.');
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
            DB::table('disbursement_requests')->where('id', $budget->id)->update(['returned_cents' => $cents, 'returned_at' => now(), 'updated_at' => now()]);
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

        return response()->json(['success' => true]);
    }
}
