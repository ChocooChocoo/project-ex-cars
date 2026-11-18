<?php

namespace App\Services\Trading;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Trading deadline notices (was checkAndNotifyOverdueReviews in src/lib/notifications/actions.ts): a 7-day review
 * window that lapsed, and a delivery downpayment deadline that passed unpaid. Each is sent once per lapse;
 * nothing is cancelled here. Runs from the scheduler (trading:deadlines) and, until the Phase 6 cron exists,
 * from the staff transaction list as before. Installment flags are Phase 6.
 */
final class Deadlines
{
    public static function notify(): int
    {
        $sent = 0;
        $now = now();

        $lapsed = DB::table('purchase_details as d')->join('transactions as t', 't.id', '=', 'd.transaction_id')
            ->where('d.downpayment_due_at', '<', $now)->whereNull('d.downpayment_forfeited_at')->where('t.current_state', 'approved')
            ->get(['d.transaction_id', 'd.downpayment_amount']);
        $told = DB::table('notifications')->where('kind', 'downpayment_missed')->whereIn('reference_id', $lapsed->pluck('transaction_id'))->pluck('reference_id')->flip();
        foreach ($lapsed as $row) {
            $payments = DB::table('payment_records')->where('transaction_id', $row->transaction_id)->get(['payment_kind', 'amount', 'verified_by']);
            if (isset($told[$row->transaction_id]) || BuyRules::verifiedPaid($payments, 'downpayment') >= (float) $row->downpayment_amount) {
                continue;
            }
            self::insert('sales_manager', 'downpayment_missed', 'Downpayment deadline passed',
                'A delivery buyer did not pay the downpayment in time. Cancel the request and promote the next On Hold buyer.', $row->transaction_id);
            $sent++;
        }

        $overdue = DB::table('transactions')->where('review_due_at', '<', $now)->whereNotIn('current_state', Trading::TERMINAL)
            ->get(['id', 'transaction_kind', 'review_due_at']);
        $existing = DB::table('notifications')->where('kind', 'review_overdue')->whereIn('reference_id', $overdue->pluck('id'))->get(['reference_id', 'created_at']);
        foreach ($overdue as $tx) {
            // A notice created after this window's due date already covers it.
            if ($existing->contains(fn ($n) => $n->reference_id === $tx->id && $n->created_at >= $tx->review_due_at)) {
                continue;
            }
            foreach ($tx->transaction_kind === 'sell' ? ['marketing_specialist', 'ceo'] : ['sales_manager'] as $role) {
                self::insert($role, 'review_overdue', 'Overdue — Awaiting Action',
                    "A {$tx->transaction_kind} transaction passed its 7-day review window without a decision. It stays open until processed.", $tx->id);
                $sent++;
            }
        }

        return $sent;
    }

    private static function insert(string $role, string $kind, string $title, string $body, string $transactionId): void
    {
        DB::table('notifications')->insert([
            'id' => (string) Str::uuid(), 'recipient_role' => $role, 'kind' => $kind, 'title' => $title, 'body' => $body,
            'reference_table' => 'transactions', 'reference_id' => $transactionId, 'created_at' => now(),
        ]);
    }
}
