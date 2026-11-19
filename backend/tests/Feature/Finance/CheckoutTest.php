<?php

namespace Tests\Feature\Finance;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Finance\Concerns\FinanceFixtures;
use Tests\TestCase;

/** Phase 6: the buyer's PayMongo checkouts (was online-payment.test.ts and financing-payments.test.ts). */
class CheckoutTest extends TestCase
{
    use FinanceFixtures, RefreshDatabase;

    private const API = 'api.paymongo.com/v1/checkout_sessions';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.paymongo.secret_key' => 'sk_test_phase6', 'services.paymongo.webhook_secret' => self::WEBHOOK_SECRET, 'app.frontend_url' => 'https://staging.example']);
        Http::preventStrayRequests();
    }

    private function sessionJson(string $id, string $status = 'active', ?string $paidPayment = null): array
    {
        return ['data' => ['id' => $id, 'attributes' => ['status' => $status, 'checkout_url' => "https://pay/{$id}",
            'payments' => $paidPayment ? [['id' => $paidPayment, 'attributes' => ['status' => 'paid']]] : []]]];
    }

    private function created(string $id): array
    {
        return ['data' => ['id' => $id, 'attributes' => ['checkout_url' => "https://pay/{$id}"]]];
    }

    private function deliverySale($buyer, string $method = 'cash'): string
    {
        $tx = $this->buyRequest($buyer, $this->vehicle(600000), $method, 'delivery', null, ['current_state' => 'approved']);
        DB::table('purchase_details')->where('transaction_id', $tx)->update(['delivery_fee' => 2500, 'downpayment_amount' => 60000, 'downpayment_due_at' => now()->addDays(3)]);

        return $tx;
    }

    #[Test]
    public function a_delivery_opens_one_checkout_for_its_fee_and_downpayment(): void
    {
        $buyer = $this->customer();
        $tx = $this->deliverySale($buyer);
        Http::fake([self::API => Http::response($this->created('cs_d'))]);

        config(['services.paymongo.secret_key' => '']);
        $this->act($buyer)->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertStatus(422)->assertJson(['message' => 'Online payment is not set up yet.']);
        config(['services.paymongo.secret_key' => 'sk_test_phase6']);

        $this->again()->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertOk()->assertJson(['url' => 'https://pay/cs_d']);
        $rows = DB::table('payment_records')->where('transaction_id', $tx)->orderBy('payment_kind')->get();
        $this->assertSame([['delivery_fee', '2500.00'], ['downpayment', '60000.00']], $rows->map(fn ($r) => [$r->payment_kind, $r->amount])->all());
        $this->assertTrue($rows->every(fn ($r) => $r->paid_at === null && $r->verified_by === null && $r->paymongo_checkout_id === 'cs_d'));
        Http::assertSent(fn ($r) => count($r['data']['attributes']['line_items']) === 2);
    }

    #[Test]
    public function a_session_paymongo_already_shows_paid_is_recorded_instead_of_reopened(): void
    {
        $buyer = $this->customer();
        $tx = $this->deliverySale($buyer);
        $fee = $this->checkoutRow($tx, 'cs_old', 'delivery_fee', '2500.00');
        $this->checkoutRow($tx, 'cs_old', 'downpayment', '60000.00');
        Http::fake([self::API.'/cs_old' => Http::response($this->sessionJson('cs_old', 'active', 'pay_7'))]);

        $this->act($buyer)->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertStatus(409)
            ->assertJson(['message' => 'Your payment is already received. Refresh the page to see it.']);
        $this->assertSame('pay_7', $this->row($fee)->paymongo_payment_id);
        $this->assertNotNull($this->row($fee)->verified_by);
        // Everything is paid now: nothing is left to open.
        $this->again()->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertStatus(422)->assertJson(['message' => 'Nothing is left to pay online.']);
    }

    #[Test]
    public function an_expired_session_is_replaced_and_nothing_due_is_refused(): void
    {
        $buyer = $this->customer();
        $tx = $this->deliverySale($buyer);
        $this->checkoutRow($tx, 'cs_gone', 'delivery_fee', '2500.00');
        Http::fake([self::API.'/cs_gone' => Http::response($this->sessionJson('cs_gone', 'expired')), self::API => Http::response($this->created('cs_fresh'))]);

        $this->act($buyer)->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertOk()->assertJson(['url' => 'https://pay/cs_fresh']);
        $this->assertSame(['cs_fresh'], DB::table('payment_records')->where('transaction_id', $tx)->distinct()->pluck('paymongo_checkout_id')->all());

        $cash = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'gce_visit', null, ['current_state' => 'approved']);
        $this->again()->postJson('/api/v1/payments/checkout', ['transaction_id' => $cash])->assertStatus(422)->assertJson(['message' => 'Nothing is due online right now.']);
        $this->act($this->account('customer'))->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertNotFound();
        $this->act($this->account('sales_manager'))->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertForbidden();
    }

    #[Test]
    public function a_financing_downpayment_at_a_visit_waits_for_the_signed_contract(): void
    {
        $buyer = $this->customer();
        $tx = $this->buyRequest($buyer, $this->vehicle(), 'financing', 'gce_visit', null, ['current_state' => 'approved', 'flow_status' => 'purchase_claim']);
        DB::table('payment_terms')->insert(['id' => (string) \Illuminate\Support\Str::uuid(), 'purchase_transaction_id' => $tx, 'arrangement_description' => 'IHF', 'agreed_by' => $buyer->id,
            'total_amount' => '550000.00', 'down_payment' => '110000.00', 'number_of_payments' => 12, 'payment_frequency' => 'monthly', 'first_due_date' => now()->addMonth()->toDateString(), 'state' => 'approved']);

        $this->act($buyer)->postJson('/api/v1/payments/checkout', ['transaction_id' => $tx])->assertStatus(422)->assertJson(['message' => 'Sign the contract before paying.']);
        $this->assertSame(0, DB::table('payment_records')->where('transaction_id', $tx)->count());
    }

    #[Test]
    public function installments_are_paid_next_due_first_or_as_ticked(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 3);
        $n = 0;
        Http::fake([self::API => function () use (&$n) {
            $n++;

            return Http::response($this->created("cs_i{$n}"));
        }]);

        $this->act($buyer)->postJson('/api/v1/payments/installment-checkout', ['transaction_id' => $sale['tx']])->assertOk()->assertJson(['url' => 'https://pay/cs_i1']);
        $row = DB::table('payment_records')->where('paymongo_checkout_id', 'cs_i1')->first();
        $this->assertSame([$sale['installments'][0], 'installment', '10000.00', $buyer->id], [$row->installment_id, $row->payment_kind, $row->amount, $row->submitted_by]);
        $this->assertNull($row->verified_by);

        // Once paid and waiting for review, the live row blocks a second checkout for the same installment.
        DB::table('payment_records')->where('id', $row->id)->update(['paid_at' => now(), 'paymongo_payment_id' => 'pay_1']);
        $this->again()->postJson('/api/v1/payments/installment-checkout', ['transaction_id' => $sale['tx'], 'advanced' => 'yes', 'installment_ids' => [$sale['installments'][0]]])
            ->assertStatus(422)->assertJson(['message' => 'A payment for a selected installment is already submitted. Wait for the review.']);
        $this->again()->postJson('/api/v1/payments/installment-checkout', ['transaction_id' => $sale['tx'], 'advanced' => 'yes', 'installment_ids' => [$sale['installments'][0], $sale['installments'][0]]])
            ->assertStatus(422)->assertJson(['message' => 'Select one or more unpaid installments.']);
        $other = $this->financedSale($this->customer(), 1);
        $this->again()->postJson('/api/v1/payments/installment-checkout', ['transaction_id' => $sale['tx'], 'advanced' => 'yes', 'installment_ids' => [$other['installments'][0]]])
            ->assertStatus(422)->assertJson(['message' => 'Select unpaid installments from this account only.']);
    }

    #[Test]
    public function an_open_session_is_reused_only_for_the_same_installments(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 3);
        [$a, $b, $c] = $sale['installments'];
        $this->checkoutRow($sale['tx'], 'cs_ab', 'installment', '10000.00', $a);
        $this->checkoutRow($sale['tx'], 'cs_ab', 'installment', '10000.00', $b);
        Http::fake([self::API.'/cs_ab' => Http::response($this->sessionJson('cs_ab')), self::API.'/cs_ab/expire' => Http::response($this->sessionJson('cs_ab', 'expired')), self::API => Http::response($this->created('cs_c'))]);

        $ticked = fn (array $ids) => ['transaction_id' => $sale['tx'], 'advanced' => 'yes', 'installment_ids' => $ids];
        $this->act($buyer)->postJson('/api/v1/payments/installment-checkout', $ticked([$b, $a]))->assertOk()->assertJson(['url' => 'https://pay/cs_ab']);
        $this->assertSame(2, DB::table('payment_records')->where('transaction_id', $sale['tx'])->count());

        // Another selection expires the abandoned session and drops its unpaid rows.
        $this->again()->postJson('/api/v1/payments/installment-checkout', $ticked([$c]))->assertOk()->assertJson(['url' => 'https://pay/cs_c']);
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/cs_ab/expire'));
        $this->assertSame([$c], DB::table('payment_records')->where('transaction_id', $sale['tx'])->pluck('installment_id')->all());
    }

    #[Test]
    public function a_rejected_installment_payment_can_be_paid_again_and_paymongo_errors_record_nothing(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 1);
        $old = $this->checkoutRow($sale['tx'], 'cs_old', 'installment', '10000.00', $sale['installments'][0]);
        DB::table('payment_records')->where('id', $old)->update(['paid_at' => now(), 'rejected_at' => now(), 'rejection_reason' => 'wrong']);
        Http::fake([self::API => Http::sequence()->push(['errors' => [['detail' => 'Service unavailable']]], 503)->push($this->created('cs_new'))]);

        $this->act($buyer)->postJson('/api/v1/payments/installment-checkout', ['transaction_id' => $sale['tx']])->assertStatus(502)
            ->assertJson(['message' => 'PayMongo could not start the payment: Service unavailable']);
        $this->assertSame(1, DB::table('payment_records')->where('transaction_id', $sale['tx'])->count());
        $this->again()->postJson('/api/v1/payments/installment-checkout', ['transaction_id' => $sale['tx']])->assertOk()->assertJson(['url' => 'https://pay/cs_new']);
    }
}
