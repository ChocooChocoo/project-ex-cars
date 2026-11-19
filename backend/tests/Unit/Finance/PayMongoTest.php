<?php

namespace Tests\Unit\Finance;

use App\Services\Finance\PayMongo;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Phase 6: src/lib/payments/paymongo.test.ts, ported. No request reaches PayMongo (Http::fake). */
class PayMongoTest extends TestCase
{
    private const SECRET = 'whsk_test_secret';

    private function header(string $raw, int $t, string $mode = 'te', string $secret = self::SECRET): string
    {
        return "t={$t},{$mode}=".hash_hmac('sha256', "{$t}.{$raw}", $secret).($mode === 'te' ? ',li=' : '');
    }

    #[Test]
    public function signatures_are_checked_on_the_raw_body(): void
    {
        $raw = '{"data":{"id":"evt_1"}}';
        $now = 1_900_000_000;
        $this->assertTrue(PayMongo::signatureValid($raw, $this->header($raw, $now), self::SECRET, $now));
        $this->assertTrue(PayMongo::signatureValid($raw, 't='.$now.',te=,li='.hash_hmac('sha256', "{$now}.{$raw}", self::SECRET), self::SECRET, $now));
        $this->assertFalse(PayMongo::signatureValid($raw, $this->header($raw, $now, 'te', 'other'), self::SECRET, $now), 'wrong secret');
        $this->assertFalse(PayMongo::signatureValid($raw.' ', $this->header($raw, $now), self::SECRET, $now), 'changed body');
        $this->assertFalse(PayMongo::signatureValid($raw, $this->header($raw, $now - 301), self::SECRET, $now), 'replayed');
        $this->assertFalse(PayMongo::signatureValid($raw, $this->header($raw, $now + 301), self::SECRET, $now), 'from the future');
        $this->assertFalse(PayMongo::signatureValid($raw, null, self::SECRET, $now), 'no header');
        $this->assertFalse(PayMongo::signatureValid($raw, $this->header($raw, $now), '', $now), 'no secret configured');
    }

    #[Test]
    public function checkout_sessions_are_created_in_centavos_without_empty_billing(): void
    {
        config(['services.paymongo.secret_key' => 'sk_test_x']);
        Http::fake(['api.paymongo.com/v1/checkout_sessions' => Http::response(['data' => ['id' => 'cs_1', 'attributes' => ['checkout_url' => 'https://pay/cs_1']]])]);

        $session = app(PayMongo::class)->create([['name' => 'Downpayment', 'cents' => 5_000_050]], 'tx-1', 'https://ok', 'https://no', ['name' => 'Juan', 'email' => 'j@x.ph', 'phone' => ' ']);

        $this->assertSame(['id' => 'cs_1', 'checkoutUrl' => 'https://pay/cs_1'], $session);
        Http::assertSent(function (Request $r) {
            $a = $r['data']['attributes'];

            return $r->method() === 'POST' && $r->hasHeader('Authorization', 'Basic '.base64_encode('sk_test_x:'))
                && $a['line_items'] === [['name' => 'Downpayment', 'amount' => 5_000_050, 'currency' => 'PHP', 'quantity' => 1]]
                && $a['payment_method_types'] === ['card', 'gcash', 'paymaya', 'dob']
                && $a['billing'] === ['name' => 'Juan', 'email' => 'j@x.ph'] && $a['reference_number'] === 'tx-1';
        });
    }

    #[Test]
    public function errors_carry_paymongos_detail_and_paid_sessions_report_their_payment(): void
    {
        Http::fake([
            'api.paymongo.com/v1/checkout_sessions' => Http::response(['errors' => [['detail' => 'amount is too large']]], 400),
            'api.paymongo.com/v1/checkout_sessions/cs_paid' => Http::response(['data' => ['id' => 'cs_paid', 'attributes' => ['status' => 'active', 'checkout_url' => 'https://pay', 'payments' => [['id' => 'pay_9', 'attributes' => ['status' => 'paid']]]]]]),
            'api.paymongo.com/v1/checkout_sessions/cs_open' => Http::response(['data' => ['id' => 'cs_open', 'attributes' => ['status' => 'active', 'checkout_url' => 'https://pay2', 'payments' => []]]]),
            'api.paymongo.com/v1/checkout_sessions/cs_done/expire' => Http::response(['errors' => [['detail' => 'already expired']]], 400),
        ]);
        $p = app(PayMongo::class);
        try {
            $p->create([['name' => 'x', 'cents' => 1]], 'r', 'a', 'b');
            $this->fail('expected an exception');
        } catch (\RuntimeException $e) {
            $this->assertSame('amount is too large', $e->getMessage());
        }
        $this->assertSame('pay_9', $p->retrieve('cs_paid')['paidPaymentId']);
        $this->assertSame(['id' => 'cs_open', 'status' => 'active', 'checkoutUrl' => 'https://pay2', 'paidPaymentId' => null], $p->retrieve('cs_open'));
        $p->expire('cs_done'); // an already-closed session is not an error
    }

    #[Test]
    public function paid_events_are_read_in_both_shapes_and_others_are_ignored(): void
    {
        $session = ['id' => 'cs_1', 'attributes' => ['payments' => [['id' => 'pay_1', 'attributes' => ['amount' => 5_000_000, 'currency' => 'PHP']]]]];
        $want = ['checkoutId' => 'cs_1', 'paymentId' => 'pay_1', 'paidCents' => 5_000_000, 'currency' => 'PHP', 'reference' => null];
        $this->assertSame($want, PayMongo::paidCheckout(['data' => ['attributes' => ['type' => 'checkout_session.payment.paid', 'data' => $session]]]));
        $this->assertSame($want, PayMongo::paidCheckout(['data' => ['type' => 'checkout_session.payment.paid', 'data' => $session]]));
        $this->assertNull(PayMongo::paidCheckout(['data' => ['attributes' => ['type' => 'payment.failed', 'data' => $session]]]));
        $this->assertNull(PayMongo::paidCheckout(['data' => ['attributes' => ['type' => 'checkout_session.payment.paid', 'data' => ['id' => 5]]]]));

        // The shape the sandbox actually sent (19 Nov 2026): no payments yet, the money on payment_intent.
        $sandbox = ['data' => ['id' => 'evt_1', 'type' => 'event', 'attributes' => ['type' => 'checkout_session.payment.paid', 'data' => ['id' => 'cs_2', 'type' => 'checkout_session',
            'attributes' => ['reference_number' => 'tx-9', 'status' => 'active', 'payments' => [],
                'payment_intent' => ['id' => 'pi_2', 'type' => 'payment_intent', 'attributes' => ['amount' => 150000, 'currency' => 'PHP', 'status' => 'processing']]]]]]];
        $this->assertSame(['checkoutId' => 'cs_2', 'paymentId' => 'pi_2', 'paidCents' => 150000, 'currency' => 'PHP', 'reference' => 'tx-9'], PayMongo::paidCheckout($sandbox));
    }
}
