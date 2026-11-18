<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Services\Trading\BuyRules;
use App\Services\Trading\Trading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The non-money financing steps (was recordVisitDecision and recordVehicleRecovered in
 * src/app/(staff)/transactions/financing-actions.ts). Terms, the account and installments are Phase 6.
 */
class FinancingVisitController extends Controller
{
    /** recordVisitDecision (§6 steps 14–16): Purchase Claim reserves the car; Potential Buyer leaves it listed. */
    public function recordVisitDecision(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasRole('sales_manager', 'ceo'), 403, 'Not authorized for this financing step.');
        $decision = $request->input('decision');
        abort_unless(in_array($decision, ['claim', 'potential'], true), 422, 'Invalid decision.');
        $id = $request->input('transaction_id');
        abort_unless(is_string($id) && Str::isUuid($id), 404, 'Financing request not found.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($id, $decision, $actorId) {
            $peek = DB::table('transactions')->where('id', $id)->first(['vehicle_id']);
            abort_unless($peek?->vehicle_id, 404, 'Financing request not found.');
            $vehicle = DB::table('vehicles')->where('id', $peek->vehicle_id)->lockForUpdate()->first(['listing_state']);
            $tx = Trading::lockTx($id);
            $details = DB::table('purchase_details')->where('transaction_id', $id)->first();
            abort_if($tx->transaction_kind !== 'buy' || ! BuyRules::isFinancingRequest($details) || $tx->current_state !== 'approved', 404, 'Financing request not found.');
            abort_unless(in_array($tx->flow_status, ['gce_visit_scheduled_dp_pending', 'potential_buyer'], true), 409, "Record the decision after the buyer's GCE visit.");
            DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)->whereIn('confirmation_state', ['pending', 'confirmed'])->update(['confirmation_state' => 'completed']);
            if ($decision === 'potential') {
                Trading::updateTx($id, ['flow_status' => 'potential_buyer', 'queue_state' => null]);
                Trading::history($id, $tx->current_state, $tx->current_state, $actorId, 'Potential Buyer: needs time, car not reserved');

                return;
            }
            abort_if($vehicle->listing_state === 'reserved', 409, 'Another buyer already holds a Purchase Claim on this car.');
            DB::table('vehicles')->where('id', $tx->vehicle_id)->update(['listing_state' => 'reserved', 'updated_at' => now()]);
            Trading::updateTx($id, ['flow_status' => 'purchase_claim']);
            $down = DB::table('payment_terms')->where('purchase_transaction_id', $id)->value('down_payment');
            if ($down !== null) {
                DB::table('purchase_details')->where('transaction_id', $id)->update(['downpayment_amount' => $down, 'downpayment_due_at' => now()->addDays(3), 'updated_at' => now()]);
            }
            Trading::history($id, $tx->current_state, $tx->current_state, $actorId, 'Purchase Claim recorded; car reserved for this buyer');
            $others = DB::table('transactions')->where('vehicle_id', $tx->vehicle_id)->where('transaction_kind', 'buy')->where('id', '!=', $id)
                ->whereIn('current_state', ['pending', 'under_review', 'approved'])->get(['id', 'customer_id']);
            foreach ($others as $other) {
                Trading::notify(['userId' => $other->customer_id], 'vehicle_claimed', 'This car is now under a Purchase Claim',
                    'Another buyer has claimed the car you asked about. Your request stays open in case the claim ends.', $other->id);
            }
        });

        return response()->json(['success' => true]);
    }

    /** recordVehicleRecovered (§6 step 26.8–10): the account closes as repossessed; reconditioning opens. */
    public function recordVehicleRecovered(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasRole('head_accountant'), 403, 'Not authorized for this financing step.');
        $id = $request->input('transaction_id');
        abort_unless(is_string($id) && Str::isUuid($id), 422, 'Invalid request.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($id, $actorId) {
            $peek = DB::table('transactions')->where('id', $id)->first(['vehicle_id']);
            abort_unless($peek?->vehicle_id, 404, 'Transaction not found.');
            DB::table('vehicles')->where('id', $peek->vehicle_id)->lockForUpdate()->first();
            $tx = Trading::lockTx($id);
            abort_if($tx->flow_status === 'repossessed', 409, 'The car is already recorded as recovered.');
            $recovery = DB::table('field_cases')->where('transaction_id', $id)->where('case_kind', 'recovery')->whereIn('state', ['in_progress', 'completed'])
                ->orderByDesc('created_at')->lockForUpdate()->first(['id', 'state']);
            abort_unless($recovery, 422, 'The Confidential Informant must start the recovery before the car can be recorded as recovered.');
            abort_if($recovery->state === 'completed', 409, 'This recovery is already closed.');
            DB::table('field_cases')->where('id', $recovery->id)->update(['state' => 'completed', 'completion_date' => now(), 'updated_at' => now()]);
            DB::table('installment_accounts')->where('purchase_transaction_id', $id)->update(['state' => 'repossessed', 'closed_date' => now()->toDateString(), 'updated_at' => now()]);
            Trading::updateTx($id, ['flow_status' => 'repossessed']);
            DB::table('vehicles')->where('id', $tx->vehicle_id)->update(['listing_state' => 'repairing', 'updated_at' => now()]);
            // One open job per car (database key): an existing open job is kept.
            if (! DB::table('reconditioning_jobs')->where('vehicle_id', $tx->vehicle_id)->where('state', '!=', 'completed')->exists()) {
                DB::table('reconditioning_jobs')->insert(['id' => (string) Str::uuid(), 'vehicle_id' => $tx->vehicle_id, 'transaction_id' => $id, 'state' => 'awaiting_report', 'created_at' => now()]);
            }
            Trading::history($id, $tx->current_state, $tx->current_state, $actorId, 'Repossessed / Recovered by GCE');
            foreach (['mechanic', 'sales_manager'] as $role) {
                Trading::notify(['role' => $role], 'vehicle_recovered', 'Repossessed car returned to GCE', $role === 'mechanic'
                    ? 'Inspect the car and submit the Overall Vehicle Status Report with a restoration estimate.'
                    : "Re-process the car's papers while it is reconditioned.", $id);
            }
        });

        return response()->json(['success' => true]);
    }
}
