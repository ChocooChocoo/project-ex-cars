<?php

namespace App\Services\Finance;

use App\Services\Trading\BuyRules;
use App\Services\Trading\Trading;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Payment and financing steps shared by the staff, customer and webhook paths (was src/lib/payments/checkout-paid.ts
 * and src/lib/transactions/financing-server.ts). Callers run inside Trading::run, so the state changes commit
 * together and the notifications go out once, after the commit.
 */
final class Payments
{
    /**
     * Marks a Checkout Session's unpaid rows paid (webhook, or Pay finding the session already paid). The rows are
     * locked and claimed in one transaction, so when the webhook and Pay race only one caller gets rows back.
     * Returns false when nothing was left unpaid, or when the provider's amount, currency or reference do not match
     * the rows this checkout was opened for (logged, nothing changed).
     *
     * T07 CR1: PayMongo proves the money arrived. An installment still needs Sales Manager approval and Head
     * Accountant verification, and a re-scheduling fee needs the Head Accountant (T10); other kinds are verified.
     */
    public static function markCheckoutPaid(string $checkoutId, ?string $paymentId, ?int $paidCents = null, ?string $currency = null, ?string $reference = null): bool
    {
        return Trading::run(function () use ($checkoutId, $paymentId, $paidCents, $currency, $reference) {
            $peek = DB::table('payment_records')->where('paymongo_checkout_id', $checkoutId)->whereNull('paid_at')->value('transaction_id');
            if (! $peek) {
                return false;
            }
            Trading::lockTx($peek);
            $rows = DB::table('payment_records')->where('paymongo_checkout_id', $checkoutId)->whereNull('paid_at')->lockForUpdate()
                ->get(['id', 'transaction_id', 'recorded_by', 'payment_kind', 'amount']);
            if ($rows->isEmpty()) {
                return false;
            }
            $txId = $rows[0]->transaction_id;
            $expected = Money::sum($rows);
            if (($paidCents !== null && $paidCents !== $expected) || ($currency !== null && strtoupper($currency) !== 'PHP') || ($reference !== null && $reference !== $txId)) {
                Log::error('PayMongo payment does not match its checkout', ['checkout' => $checkoutId, 'expected_cents' => $expected, 'paid_cents' => $paidCents, 'currency' => $currency, 'reference' => $reference]);

                return false;
            }

            DB::table('payment_records')->whereIn('id', $rows->pluck('id'))->update(['paid_at' => now(), 'paymongo_payment_id' => $paymentId]);
            $installments = $rows->where('payment_kind', 'installment');
            $fees = $rows->where('payment_kind', 'reschedule_fee');
            $settled = $rows->reject(fn ($r) => in_array($r->payment_kind, ['installment', 'reschedule_fee'], true));
            foreach ($settled as $row) {
                DB::table('payment_records')->where('id', $row->id)->update(['verified_by' => $row->recorded_by]);
                // SN-10: PayMongo proved the money arrived, so these rows are verified on the spot. Same key as the
                // Head Accountant's verify step, so a payment that took both paths posts its revenue once.
                Ledger::post('revenue', Money::cents($row->amount), 'Buyer payment verified: '.str_replace('_', ' ', (string) ($row->payment_kind ?? 'payment')),
                    'payment:'.$row->id, (string) $row->recorded_by, $txId);
            }

            self::confirmInitialDownpaymentIfPaid($txId);
            if ($settled->isNotEmpty()) {
                self::notifyInformantIfPaidInFull($txId);
                $total = Money::peso(Money::sum($settled));
                foreach (['head_accountant', 'sales_manager'] as $role) {
                    Trading::notify(['role' => $role], 'online_payment_paid', 'Payment received on PayMongo', "The buyer paid ₱{$total} through PayMongo. It is recorded as verified.", $txId);
                }
            }
            if ($fees->isNotEmpty()) {
                Trading::notify(['role' => 'head_accountant'], 'reschedule_fee_paid', 'Re-scheduling fee paid on PayMongo', 'The buyer paid the delivery re-scheduling fee. Verify it to send the new schedule to the team.', $txId);
            }
            if ($installments->isNotEmpty()) {
                $total = Money::peso(Money::sum($installments));
                $count = $installments->count();
                Trading::notify(['role' => 'sales_manager'], 'installment_awaiting_approval', 'Online installment waiting for your approval',
                    "The buyer paid ₱{$total} for {$count} installment".($count === 1 ? '' : 's').' through PayMongo. Approve it for the Head Accountant.', $txId);
                Trading::notify(['role' => 'head_accountant'], 'installment_awaiting_approval', 'Online installment waiting for Sales Manager approval',
                    "The buyer paid ₱{$total} through PayMongo. The Sales Manager must approve it before you verify.", $txId);
            }

            return true;
        });
    }

    /** §6 step 18: once verified downpayments cover the agreed one, the Initial Downpayment is confirmed. */
    public static function confirmInitialDownpaymentIfPaid(string $txId): void
    {
        $tx = DB::table('transactions')->where('id', $txId)->first(['id', 'flow_status', 'transaction_kind']);
        if ($tx?->flow_status !== 'initial_dp_awaiting_verification') {
            return;
        }
        $terms = DB::table('payment_terms')->where('purchase_transaction_id', $txId)->first(['down_payment']);
        $details = DB::table('purchase_details')->where('transaction_id', $txId)->first(['payment_method', 'arrangement_kind']);
        if (! $terms || ! BuyRules::isFinancingRequest($details)) {
            return;
        }
        $payments = DB::table('payment_records')->where('transaction_id', $txId)->get(['payment_kind', 'amount', 'verified_by', 'rejected_at']);
        if (PaymentRules::verifiedPaid($payments, 'downpayment') < Money::cents($terms->down_payment)) {
            return;
        }
        Trading::updateTx($txId, ['flow_status' => 'initial_dp_confirmed']);
        Trading::notify(['role' => 'head_accountant'], 'initial_dp_confirmed', 'Initial Downpayment confirmed', 'Complete the financing agreement to open the account.', $txId);
    }

    /** §6 step 25: every installment paid or waived closes the account and completes the financing. */
    public static function closeFinancingIfPaid(string $txId): void
    {
        $account = DB::table('installment_accounts')->where('purchase_transaction_id', $txId)->lockForUpdate()->first(['id', 'state']);
        if ($account?->state !== 'active') {
            return;
        }
        if (! BuyRules::financingFullyPaid(DB::table('installments')->where('account_id', $account->id)->get(['state']))) {
            return;
        }
        DB::table('installment_accounts')->where('id', $account->id)->update(['state' => 'closed', 'closed_date' => now()->toDateString(), 'updated_at' => now()]);
        DB::table('payment_terms')->where('purchase_transaction_id', $txId)->update(['state' => 'completed', 'updated_at' => now()]);
        Trading::updateTx($txId, ['flow_status' => 'financing_completed']);
        $customer = DB::table('transactions')->where('id', $txId)->value('customer_id');
        if ($customer) {
            Trading::notify(['userId' => $customer], 'financing_completed', 'Your financing is fully paid', 'Every installment is paid. Your In-House Financing account is now closed.', $txId);
        }
    }

    /** T10: a direct-payment buyer's verified money covers the price → the CIs on its field cases are told. */
    public static function notifyInformantIfPaidInFull(string $txId): void
    {
        $details = DB::table('purchase_details')->where('transaction_id', $txId)->first(['payment_method', 'final_price']);
        if (! BuyRules::isDirectPayment($details)) {
            return;
        }
        $payments = DB::table('payment_records')->where('transaction_id', $txId)->get(['payment_kind', 'amount', 'verified_by', 'rejected_at']);
        if (PaymentRules::verifiedTowardPrice($payments) < Money::cents($details->final_price)) {
            return;
        }
        DB::table('field_cases')->where('transaction_id', $txId)->whereIn('case_kind', ['delivery', 'buyer_meetup'])->where('state', '!=', 'cancelled')
            ->whereNotNull('assigned_confidential_informant')->distinct()->pluck('assigned_confidential_informant')
            ->each(fn ($ci) => Trading::notify(['userId' => $ci], 'buyer_paid_in_full', "Buyer's payment verified",
                "The Head Accountant verified the buyer's full payment. Mark the car delivered and release the papers.", $txId));
    }

    /** §6 step 19: opens the installment account and its schedule from approved terms; marks the terms active. */
    public static function openFinancingAccount(object $terms): string
    {
        $total = Money::cents($terms->total_amount);
        $down = Money::cents($terms->down_payment);
        $schedule = PaymentRules::schedule($total, $down, (int) $terms->number_of_payments, CarbonImmutable::parse($terms->first_due_date), (string) $terms->payment_frequency);
        $accountId = (string) Str::uuid();
        DB::table('installment_accounts')->insert([
            'id' => $accountId, 'purchase_transaction_id' => $terms->purchase_transaction_id, 'financed_total' => Money::decimal($total),
            'down_payment' => Money::decimal($down), 'opening_balance' => Money::decimal($total - $down), 'start_date' => $terms->first_due_date,
            'state' => 'active', 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('installments')->insert(array_map(fn ($s) => [
            'id' => (string) Str::uuid(), 'account_id' => $accountId, 'sequence_no' => $s['sequence_no'], 'due_date' => $s['due_date'],
            'amount_due' => Money::decimal($s['cents']), 'state' => 'upcoming',
        ], $schedule));
        DB::table('payment_terms')->where('id', $terms->id)->update(['state' => 'active', 'updated_at' => now()]);

        return $accountId;
    }
}
