<?php

namespace Tests\Feature\Finance\Concerns;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Trading\Concerns\TradingFixtures;

/** Financing accounts, PayMongo rows and signed webhook calls for the Phase 6 tests. */
trait FinanceFixtures
{
    use TradingFixtures;

    protected const WEBHOOK_SECRET = 'whsk_test_phase6';

    /** An approved financing buy with an active account of $count monthly installments of $each pesos. */
    protected function financedSale(User $customer, int $count = 3, string $each = '10000.00'): array
    {
        $tx = $this->buyRequest($customer, $this->vehicle(600000, 'reserved'), 'financing', 'gce_visit', null, ['current_state' => 'approved', 'flow_status' => 'financing_active']);
        $termsId = (string) Str::uuid();
        DB::table('payment_terms')->insert(['id' => $termsId, 'purchase_transaction_id' => $tx, 'arrangement_description' => 'In-House Financing', 'agreed_by' => $customer->id, 'total_amount' => '660000.00', 'down_payment' => '120000.00',
            'number_of_payments' => $count, 'payment_frequency' => 'monthly', 'first_due_date' => now()->addMonth()->toDateString(), 'state' => 'active', 'created_at' => now(), 'updated_at' => now()]);
        $account = (string) Str::uuid();
        DB::table('installment_accounts')->insert(['id' => $account, 'purchase_transaction_id' => $tx, 'financed_total' => '660000.00', 'down_payment' => '120000.00',
            'opening_balance' => '540000.00', 'start_date' => now()->toDateString(), 'state' => 'active']);
        $ids = [];
        for ($i = 1; $i <= $count; $i++) {
            $ids[] = $id = (string) Str::uuid();
            DB::table('installments')->insert(['id' => $id, 'account_id' => $account, 'sequence_no' => $i, 'due_date' => now()->addMonths($i)->toDateString(), 'amount_due' => $each, 'state' => 'upcoming']);
        }

        return ['tx' => $tx, 'account' => $account, 'installments' => $ids];
    }

    /** An unpaid PayMongo row on checkout $checkout. */
    protected function checkoutRow(string $tx, string $checkout, string $kind, string $amount, ?string $installmentId = null, int $part = 1): string
    {
        DB::table('payment_records')->insert(['id' => $id = (string) Str::uuid(), 'transaction_id' => $tx, 'installment_id' => $installmentId, 'amount' => $amount,
            'method' => 'paymongo', 'payment_kind' => $kind, 'part_no' => $part, 'recorded_by' => DB::table('transactions')->where('id', $tx)->value('customer_id'),
            'settlement_date' => now()->toDateString(), 'paymongo_checkout_id' => $checkout, 'created_at' => now()]);

        return $id;
    }

    /** The JSON PayMongo sends for a paid checkout, and its Paymongo-Signature header. */
    protected function paidEvent(string $checkout, int $cents, string $reference, string $payment = 'pay_1', string $currency = 'PHP'): array
    {
        $raw = json_encode(['data' => ['attributes' => ['type' => 'checkout_session.payment.paid', 'data' => ['id' => $checkout,
            'attributes' => ['reference_number' => $reference, 'payments' => [['id' => $payment, 'attributes' => ['amount' => $cents, 'currency' => $currency]]]]]]]]);
        $t = time();

        return [$raw, "t={$t},te=".hash_hmac('sha256', "{$t}.{$raw}", self::WEBHOOK_SECRET).',li='];
    }

    protected function webhook(string $raw, string $signature): \Illuminate\Testing\TestResponse
    {
        return $this->call('POST', '/api/v1/paymongo/webhook', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_PAYMONGO_SIGNATURE' => $signature], content: $raw);
    }

    protected function row(string $id): object
    {
        return DB::table('payment_records')->where('id', $id)->first();
    }
}
