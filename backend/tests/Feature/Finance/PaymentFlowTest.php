<?php

namespace Tests\Feature\Finance;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Finance\Concerns\FinanceFixtures;
use Tests\TestCase;

/**
 * Phase 6: payment receipt, approval and verification against Laravel (was the webhook, checkout-paid and payment
 * action vitest suites). PayMongo is faked; no request leaves the test.
 */
class PaymentFlowTest extends TestCase
{
    use FinanceFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.paymongo.webhook_secret' => self::WEBHOOK_SECRET, 'services.paymongo.secret_key' => 'sk_test_phase6', 'app.frontend_url' => 'https://staging.example']);
        Http::preventStrayRequests();
    }

    #[Test]
    public function the_webhook_marks_a_delivery_payment_paid_and_verified_once(): void
    {
        $buyer = $this->customer();
        $tx = $this->buyRequest($buyer, $this->vehicle(), 'bank_transfer', 'delivery', null, ['current_state' => 'approved']);
        $fee = $this->checkoutRow($tx, 'cs_del', 'delivery_fee', '2500.00');
        $dp = $this->checkoutRow($tx, 'cs_del', 'downpayment', '50000.50');
        [$raw, $sig] = $this->paidEvent('cs_del', 5_250_050, $tx);

        $this->webhook($raw, 'bad')->assertStatus(401);
        $this->assertNull($this->row($fee)->paid_at, 'an unsigned call changes nothing');

        $this->webhook($raw, $sig)->assertOk()->assertJson(['received' => true]);
        foreach ([$fee, $dp] as $id) {
            $row = $this->row($id);
            $this->assertNotNull($row->paid_at);
            $this->assertSame('pay_1', $row->paymongo_payment_id);
            $this->assertSame($buyer->id, $row->verified_by);
        }
        $notices = DB::table('notifications')->where('kind', 'online_payment_paid')->count();
        $this->assertSame(2, $notices);
        $this->assertStringContainsString('₱52,500.50', DB::table('notifications')->where('kind', 'online_payment_paid')->value('body'));

        // A redelivered event finds nothing unpaid: no second notice.
        $this->webhook($raw, $sig)->assertOk();
        $this->assertSame($notices, DB::table('notifications')->where('kind', 'online_payment_paid')->count());
    }

    #[Test]
    public function a_payment_that_does_not_match_its_checkout_changes_nothing(): void
    {
        $buyer = $this->customer();
        $tx = $this->buyRequest($buyer, $this->vehicle(), 'bank_transfer', 'gce_visit', null, ['current_state' => 'approved']);
        $row = $this->checkoutRow($tx, 'cs_m', 'balance', '500000.00');

        foreach ([
            $this->paidEvent('cs_m', 49_999_999, $tx),                    // wrong amount
            $this->paidEvent('cs_m', 50_000_000, $tx, 'pay_1', 'USD'),     // wrong currency
            $this->paidEvent('cs_m', 50_000_000, (string) Str::uuid()),    // another transaction's reference
            $this->paidEvent('cs_unknown', 50_000_000, $tx),               // a checkout we never opened
        ] as [$raw, $sig]) {
            $this->webhook($raw, $sig)->assertOk();
        }
        $this->assertNull($this->row($row)->paid_at);
        $this->assertSame(0, DB::table('notifications')->count());

        // Other event types are acknowledged and ignored.
        $raw = json_encode(['data' => ['attributes' => ['type' => 'payment.failed', 'data' => ['id' => 'cs_m']]]]);
        $t = time();
        $this->webhook($raw, "t={$t},te=".hash_hmac('sha256', "{$t}.{$raw}", self::WEBHOOK_SECRET))->assertOk();
        $this->assertNull($this->row($row)->paid_at);
    }

    #[Test]
    public function one_advance_checkout_settles_several_installments_only_after_both_staff_steps(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 2);
        $sm = $this->account('sales_manager');
        $ha = $this->account('head_accountant');
        $rows = array_map(fn ($i) => $this->checkoutRow($sale['tx'], 'cs_adv', 'installment', '10000.00', $i), $sale['installments']);
        [$raw, $sig] = $this->paidEvent('cs_adv', 2_000_000, $sale['tx']);
        $this->webhook($raw, $sig)->assertOk();

        // Paid, but not verified: the Sales Manager approves, then the Head Accountant verifies.
        $this->assertNull($this->row($rows[0])->verified_by);
        $this->assertSame(1, DB::table('notifications')->where('kind', 'installment_awaiting_approval')->where('recipient_role', 'sales_manager')->count());
        $this->act($ha)->postJson('/api/v1/staff/payments/verify', ['payment_id' => $rows[0]])->assertStatus(422)->assertJson(['message' => 'The Sales Manager must approve this online payment first.']);
        $this->act($ha)->postJson('/api/v1/staff/payments/approve-online', ['payment_id' => $rows[0]])->assertForbidden();

        foreach ($rows as $id) {
            $this->act($sm)->postJson('/api/v1/staff/payments/approve-online', ['payment_id' => $id])->assertOk();
        }
        $this->again()->postJson('/api/v1/staff/payments/approve-online', ['payment_id' => $rows[0]])->assertStatus(409);
        $this->act($ha)->postJson('/api/v1/staff/payments/verify', ['payment_id' => $rows[0]])->assertOk();
        $this->assertSame('active', DB::table('installment_accounts')->where('id', $sale['account'])->value('state'), 'one of two paid: still open');
        $this->again()->postJson('/api/v1/staff/payments/verify', ['payment_id' => $rows[0]])->assertStatus(409);
        $this->again()->postJson('/api/v1/staff/payments/verify', ['payment_id' => $rows[1]])->assertOk();

        $this->assertSame(['paid', 'paid'], DB::table('installments')->whereIn('id', $sale['installments'])->orderBy('sequence_no')->pluck('state')->all());
        $this->assertSame('closed', DB::table('installment_accounts')->where('id', $sale['account'])->value('state'));
        $this->assertSame('financing_completed', DB::table('transactions')->where('id', $sale['tx'])->value('flow_status'));
        $this->assertSame('completed', DB::table('payment_terms')->where('purchase_transaction_id', $sale['tx'])->value('state'));
    }

    #[Test]
    public function cash_payments_are_decided_by_the_server_and_recorded_once(): void
    {
        $buyer = $this->customer();
        $sm = $this->account('sales_manager');
        $tx = $this->buyRequest($buyer, $this->vehicle(600000), 'cash', 'gce_visit', null, ['current_state' => 'approved']);
        $form = ['transaction_id' => $tx, 'amount' => 1, 'method' => 'bank_transfer', 'settlement_date' => now()->toDateString(), 'payment_kind' => 'downpayment'];

        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/payments/record', $form)->assertStatus(422)->assertJson(['message' => 'The Sales Manager records the payment. The Head Accountant verifies it.']);
        $this->act($this->account('mechanic'))->postJson('/api/v1/staff/payments/record', $form)->assertForbidden();

        $this->act($sm)->postJson('/api/v1/staff/payments/record', $form)->assertOk();
        $row = DB::table('payment_records')->where('transaction_id', $tx)->first();
        $this->assertSame(['600000.00', 'cash', 'full'], [$row->amount, $row->method, $row->payment_kind], 'the typed amount, method and kind are ignored');
        $this->again()->postJson('/api/v1/staff/payments/record', $form)->assertStatus(422)->assertJson(['message' => 'Nothing is due on this purchase.']);
        $this->assertSame(1, DB::table('notifications')->where('kind', 'installment_recorded')->count());
        $this->assertSame(1, DB::table('audit_events')->where('action', 'payment_recorded')->count());
    }

    #[Test]
    public function a_rejected_payment_reopens_its_installment_and_can_be_recorded_again(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 2);
        $sm = $this->account('sales_manager');
        $ha = $this->account('head_accountant');
        $form = ['transaction_id' => $sale['tx'], 'installment_id' => $sale['installments'][0], 'amount' => 1, 'method' => 'bank_transfer', 'settlement_date' => now()->toDateString()];

        $this->act($sm)->postJson('/api/v1/staff/payments/record', $form)->assertOk();
        $first = DB::table('payment_records')->where('installment_id', $sale['installments'][0])->value('id');
        $this->assertSame(['10000.00', 'cash'], [$this->row($first)->amount, $this->row($first)->method]);
        $this->again()->postJson('/api/v1/staff/payments/record', $form)->assertStatus(409)->assertJson(['message' => 'This payment is already recorded.']);

        $this->act($ha)->postJson('/api/v1/staff/payments/reject', ['payment_id' => $first, 'reason' => ' '])->assertStatus(422);
        $this->again()->postJson('/api/v1/staff/payments/reject', ['payment_id' => $first, 'reason' => 'Receipt is unreadable'])->assertOk();
        $this->again()->postJson('/api/v1/staff/payments/verify', ['payment_id' => $first])->assertStatus(409)->assertJson(['message' => 'This payment was rejected.']);
        $this->assertSame('upcoming', DB::table('installments')->where('id', $sale['installments'][0])->value('state'));
        $this->assertStringContainsString('₱10,000.00 was not accepted: Receipt is unreadable', DB::table('notifications')->where('kind', 'payment_rejected')->value('body'));

        // The rejected row frees its place: a new row for the same installment is accepted and verified.
        $this->act($sm)->postJson('/api/v1/staff/payments/record', $form)->assertOk();
        $second = DB::table('payment_records')->where('installment_id', $sale['installments'][0])->whereNull('rejected_at')->value('id');
        $this->act($ha)->postJson('/api/v1/staff/payments/verify', ['payment_id' => $second])->assertOk();
        $this->assertSame('paid', DB::table('installments')->where('id', $sale['installments'][0])->value('state'));
    }

    #[Test]
    public function staff_paths_refuse_the_wrong_role_record_or_state(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 2);
        $sm = $this->account('sales_manager');
        $ha = $this->account('head_accountant');

        // Advance payment: Sales Manager only, picked installments of this account, not settled.
        foreach (['head_accountant', 'account_manager'] as $role) {
            $this->act($this->account($role))->postJson('/api/v1/staff/payments/advance', ['transaction_id' => $sale['tx'], 'installment_ids' => $sale['installments']])->assertForbidden();
        }
        $this->act($sm)->postJson('/api/v1/staff/payments/advance', ['transaction_id' => $sale['tx'], 'installment_ids' => []])->assertStatus(422)->assertJson(['message' => 'Pick at least one installment to pay in advance.']);
        $other = $this->financedSale($this->customer(), 1);
        $this->again()->postJson('/api/v1/staff/payments/advance', ['transaction_id' => $sale['tx'], 'installment_ids' => [$sale['installments'][0], $other['installments'][0]]])
            ->assertStatus(422)->assertJson(['message' => 'Installment not found.']);
        DB::table('installments')->where('id', $sale['installments'][1])->update(['state' => 'waived']);
        $this->again()->postJson('/api/v1/staff/payments/advance', ['transaction_id' => $sale['tx'], 'installment_ids' => $sale['installments']])
            ->assertStatus(422)->assertJson(['message' => 'This installment is already settled.']);
        $this->assertSame(0, DB::table('payment_records')->where('transaction_id', $sale['tx'])->count(), 'a refused advance records none of its rows');
        $this->again()->postJson('/api/v1/staff/payments/advance', ['transaction_id' => $sale['tx'], 'installment_ids' => [$sale['installments'][0]]])->assertOk()->assertJson(['recorded' => 1]);
        $this->assertSame(1, DB::table('notifications')->where('kind', 'installment_recorded')->count());
        $this->act($ha)->postJson('/api/v1/staff/payments/record', ['transaction_id' => $sale['tx'], 'installment_id' => $sale['installments'][0], 'amount' => 1, 'method' => 'cash', 'settlement_date' => now()->toDateString()])
            ->assertStatus(422)->assertJson(['message' => 'The Sales Manager records the installment. The Head Accountant verifies it.']);

        // Approval is only for a confirmed PayMongo installment.
        $cash = DB::table('payment_records')->where('transaction_id', $sale['tx'])->value('id');
        $this->act($sm)->postJson('/api/v1/staff/payments/approve-online', ['payment_id' => $cash])->assertStatus(422)->assertJson(['message' => 'Only an online installment needs Sales Manager approval.']);
        $pending = $this->checkoutRow($other['tx'], 'cs_wait', 'installment', '10000.00', $other['installments'][0]);
        $this->again()->postJson('/api/v1/staff/payments/approve-online', ['payment_id' => $pending])->assertStatus(422)->assertJson(['message' => 'PayMongo has not confirmed this payment yet.']);

        // A staff PayMongo row cannot be typed in, and a contract sale takes no money before signing.
        $meetup = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'meetup', null, ['current_state' => 'approved']);
        $this->act($sm)->postJson('/api/v1/staff/payments/record', ['transaction_id' => $meetup, 'amount' => 1, 'method' => 'paymongo', 'settlement_date' => now()->toDateString()])->assertStatus(422);
        DB::table('purchase_details')->where('transaction_id', $meetup)->update(['payment_method' => 'financing']);
        $this->again()->postJson('/api/v1/staff/payments/record', ['transaction_id' => $meetup, 'amount' => 1000, 'method' => 'financing', 'settlement_date' => now()->toDateString(), 'payment_kind' => 'balance'])
            ->assertStatus(422)->assertJson(['message' => 'The buyer must sign the contract before a payment is recorded.']);
    }

    #[Test]
    public function waiving_the_last_unpaid_installment_closes_the_account(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 2);
        DB::table('installments')->where('id', $sale['installments'][0])->update(['state' => 'paid']);
        $this->act($this->account('sales_manager'))->postJson('/api/v1/staff/payments/waive-installment', ['installment_id' => $sale['installments'][1]])->assertForbidden();
        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/payments/waive-installment', ['installment_id' => $sale['installments'][1]])->assertOk();
        $this->assertSame('closed', DB::table('installment_accounts')->where('id', $sale['account'])->value('state'));
        $this->assertSame(1, DB::table('notifications')->where('kind', 'financing_completed')->where('recipient_id', $buyer->id)->count());
    }

    #[Test]
    public function the_buyer_opens_one_checkout_and_reuses_it_while_it_is_open(): void
    {
        $buyer = $this->customer();
        $tx = $this->buyRequest($buyer, $this->vehicle(600000), 'bank_transfer', 'gce_visit', null, ['current_state' => 'approved']);
        Http::fake([
            'api.paymongo.com/v1/checkout_sessions' => Http::response(['data' => ['id' => 'cs_new', 'attributes' => ['checkout_url' => 'https://pay/cs_new']]]),
            'api.paymongo.com/v1/checkout_sessions/cs_new' => Http::response(['data' => ['id' => 'cs_new', 'attributes' => ['status' => 'active', 'checkout_url' => 'https://pay/cs_new', 'payments' => []]]]),
        ]);

        $this->act($this->account('customer'))->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertNotFound();
        $this->act($buyer)->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertOk()->assertJson(['success' => true, 'url' => 'https://pay/cs_new']);
        $row = DB::table('payment_records')->where('transaction_id', $tx)->first();
        $this->assertSame(['balance', '600000.00', 1, 'cs_new'], [$row->payment_kind, $row->amount, (int) $row->part_no, $row->paymongo_checkout_id]);
        Http::assertSent(fn ($r) => $r->url() === 'https://api.paymongo.com/v1/checkout_sessions' && $r['data']['attributes']['line_items'][0]['amount'] === 60_000_000
            && $r['data']['attributes']['success_url'] === "https://staging.example/customer/my-transactions/{$tx}?paid=1");

        // Pay again: the open session is reused, nothing new is recorded.
        $this->again()->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertOk()->assertJson(['url' => 'https://pay/cs_new']);
        $this->assertSame(1, DB::table('payment_records')->where('transaction_id', $tx)->count());
    }

    #[Test]
    public function a_large_balance_is_paid_in_distinct_parts(): void
    {
        $buyer = $this->customer();
        $tx = $this->buyRequest($buyer, $this->vehicle(1500000), 'bank_transfer', 'gce_visit', null, ['current_state' => 'approved']);
        $ha = $this->account('head_accountant');
        $sessions = 0;
        Http::fake(function ($request) use (&$sessions) {
            $sessions++;

            return Http::response(['data' => ['id' => "cs_part{$sessions}", 'attributes' => ['checkout_url' => "https://pay/{$sessions}"]]]);
        });

        $this->act($buyer)->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertOk();
        $part1 = DB::table('payment_records')->where('paymongo_checkout_id', 'cs_part1')->first();
        $this->assertSame(['999000.00', 1], [$part1->amount, (int) $part1->part_no]);
        [$raw, $sig] = $this->paidEvent('cs_part1', 99_900_000, $tx);
        $this->webhook($raw, $sig)->assertOk(); // a balance is verified by PayMongo itself

        $this->act($buyer)->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertOk();
        $part2 = DB::table('payment_records')->where('paymongo_checkout_id', 'cs_part2')->first();
        $this->assertSame(['501000.00', 2], [$part2->amount, (int) $part2->part_no]);
        unset($ha);
    }
}
