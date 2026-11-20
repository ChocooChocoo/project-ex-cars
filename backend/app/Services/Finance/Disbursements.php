<?php

namespace App\Services\Finance;

use App\Services\NotificationService;
use App\Services\Trading\Trading;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Car-purchase disbursements (was the complete_purchase_disbursement SQL function, latest version in
 * supabase/migrations/20261116140000_t11_recondition_known_issues.sql). Call inside Trading::run.
 */
final class Disbursements
{
    /**
     * The seller is paid: the request becomes paid, a sell transaction completes, and the bought car goes to
     * reconditioning (inspection issue, declared issue or issue report) or to posting. Locks the request, then the
     * transaction. Repeats change nothing and add no second event or notice.
     */
    public static function completePurchase(string $disbursementId, string $actorId, bool $actorIsHeadAccountant, ?string $notes): void
    {
        $request = DB::table('disbursement_requests')->where('id', $disbursementId)->lockForUpdate()->first();
        abort_unless($request && $request->purchase_transaction_id, 404, 'Purchase disbursement not found.');
        abort_unless($actorIsHeadAccountant || $request->requested_by === $actorId, 403,
            'Only the person who received the funds, or the Head Accountant, can record the seller paid.');
        abort_unless(in_array($request->status, ['released', 'received', 'paid'], true), 409, "Cannot move from {$request->status} to paid.");

        $tx = Trading::lockTx($request->purchase_transaction_id);
        abort_unless($tx, 404, 'Purchase transaction not found.');
        $sell = $tx->transaction_kind === 'sell';
        abort_if($sell && ! ($tx->current_state === 'approved' || ($request->status === 'paid' && $tx->current_state === 'completed')), 409, 'Sell transaction is not waiting for payment.');
        abort_if($sell && $request->status !== 'paid' && ! DB::table('sell_details')->where('transaction_id', $tx->id)->whereNotNull('cleared_for_payment_at')->exists(),
            422, 'The car is not cleared for payment yet.');

        DB::table('disbursement_requests')->where('id', $request->id)->whereIn('status', ['released', 'received'])->update(['status' => 'paid', 'updated_at' => now()]);
        if (! DB::table('disbursement_events')->where('disbursement_id', $request->id)->where('event_kind', 'paid')->exists()) {
            self::event($request->id, 'paid', $actorId, $notes);
        }
        if (! $sell) {
            return; // Non-selling purchase requests keep their payment-only behaviour.
        }

        if ($tx->current_state === 'approved') {
            Trading::updateTx($tx->id, ['current_state' => 'completed', 'completed_at' => now(), 'flow_status' => null, 'review_due_at' => null]);
            Trading::history($tx->id, 'approved', 'completed', $actorId, 'Seller paid');
        }
        $sellDetails = DB::table('sell_details')->where('transaction_id', $tx->id)->first(['agreed_price', 'has_known_issues']);
        self::notifyOnce(['role' => 'ceo'], 'sell_payment_disbursed', 'Seller payment disbursed',
            'GCE paid ₱'.Money::decimal(Money::cents($sellDetails?->agreed_price)).' for a seller\'s car.', 'transactions', $tx->id);
        // BH-3: the Head Accountant gets one "Car fully paid" record instead of a zero-value return task.
        $vehicle = DB::table('vehicles')->where('id', $tx->vehicle_id)->first(['year', 'make', 'model', 'stock_code']);
        $car = $vehicle ? trim($vehicle->year.' '.$vehicle->make.' '.$vehicle->model) : 'A car';
        if ($vehicle?->stock_code) {
            $car .= " ({$vehicle->stock_code})";
        }
        $seller = DB::table('profiles')->where('id', $tx->customer_id)->value('full_name');
        self::notifyOnce(['role' => 'head_accountant'], 'sell_car_fully_paid', 'Car fully paid',
            "{$car} bought from ".($seller ?: 'the seller').' for '.Money::currency(Money::cents($sellDetails?->agreed_price)).'. Status: seller paid in full.',
            'transactions', $tx->id);

        $case = DB::table('field_cases')->where('transaction_id', $tx->id)->where('case_kind', 'acquisition')->where('state', '!=', 'cancelled')
            ->orderByDesc('created_at')->first(['mechanic_id', 'inspection_outcome']);
        $hasIssue = $case?->inspection_outcome === 'issue_found' || (bool) $sellDetails?->has_known_issues
            || DB::table('inspection_issue_reports')->where('transaction_id', $tx->id)->exists();

        if ($hasIssue) {
            if (DB::table('vehicles')->where('id', $tx->vehicle_id)->where('listing_state', 'draft')->update(['listing_state' => 'repairing', 'updated_at' => now()]) > 0) {
                if (! DB::table('reconditioning_jobs')->where('vehicle_id', $tx->vehicle_id)->where('state', '!=', 'completed')->exists()) {
                    DB::table('reconditioning_jobs')->insert(['id' => (string) Str::uuid(), 'vehicle_id' => $tx->vehicle_id, 'transaction_id' => $tx->id, 'mechanic_id' => $case?->mechanic_id,
                        'created_at' => now()]);
                }
                $to = $case?->mechanic_id ? ['userId' => $case->mechanic_id] : ['role' => 'mechanic'];
                Trading::notify($to, 'reconditioning', 'Bought car needs reconditioning',
                    'GCE paid the seller. Photograph each part to repair or replace and send the parts table to the Head Accountant.', $tx->vehicle_id, 'vehicles');
            }
        } elseif (DB::table('vehicles')->where('id', $tx->vehicle_id)->where('listing_state', 'draft')->update(['listing_state' => 'awaiting_price_approval', 'updated_at' => now()]) > 0) {
            self::notifyOnce(['role' => 'marketing_specialist'], 'sell_vehicle_ready_to_post', 'Bought car ready to post',
                'GCE paid the seller. Add photos, propose a selling price and post the car.', 'transactions', $tx->id);
        }
    }

    public static function event(string $disbursementId, string $kind, string $actorId, ?string $notes): void
    {
        DB::table('disbursement_events')->insert(['id' => (string) Str::uuid(), 'disbursement_id' => $disbursementId, 'event_kind' => $kind,
            'actor_id' => $actorId, 'notes' => ($notes ?? '') !== '' ? $notes : null, 'created_at' => now()]);
    }

    /**
     * A role notice the SQL inserted WHERE NOT EXISTS: one per transaction and kind. Written inside the transaction,
     * under the request's row lock, so a concurrent repeat sees it and adds none.
     */
    private static function notifyOnce(array $to, string $kind, string $title, string $body, string $table, string $id): void
    {
        if (! DB::table('notifications')->where('reference_table', $table)->where('reference_id', $id)->where('kind', $kind)->where('recipient_role', $to['role'])->exists()) {
            app(NotificationService::class)->send($to, $kind, $title, $body, $table, $id);
        }
    }
}
