<?php

namespace Tests\Unit\Finance;

use App\Services\Finance\Money;
use App\Services\Finance\PaymentRules;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/** Phase 6: the money rules of buy-flow.ts / installments.ts, ported with their vitest cases, in centavos. */
class PaymentRulesTest extends TestCase
{
    private function pay(string $kind, int|string $amount, bool $verified = true, bool $rejected = false): object
    {
        return (object) ['payment_kind' => $kind, 'amount' => $amount, 'verified_by' => $verified ? 'ha' : null, 'rejected_at' => $rejected ? '2033-03-01' : null];
    }

    private function d(array $fields): object
    {
        return (object) ($fields + ['payment_method' => null, 'arrangement_kind' => null, 'delivery_fee' => null, 'downpayment_amount' => null, 'downpayment_due_at' => null, 'final_price' => null]);
    }

    #[Test]
    public function money_is_exact_centavos(): void
    {
        $this->assertSame(60000050, Money::cents('600000.50'));
        $this->assertSame(30, Money::cents(0.1) + Money::cents(0.2));
        $this->assertSame(0, Money::cents(null));
        $this->assertSame('600000.50', Money::decimal(60000050));
        $this->assertSame('0.03', Money::decimal(3));
        $this->assertSame(30, Money::sum([(object) ['amount' => '0.10'], (object) ['amount' => '0.20']]));
        $this->assertSame('501,000', Money::peso(50100000));
        $this->assertSame('1,234.50', Money::peso(123450));
    }

    #[Test]
    public function bank_transfer_online_payments_follow_the_contract(): void
    {
        $price = 60_000_000;
        $dp = 5_000_000;
        $visit = $this->d(['payment_method' => 'bank_transfer', 'arrangement_kind' => 'gce_visit', 'final_price' => '600000']);
        $this->assertSame([['kind' => 'balance', 'label' => 'Balance', 'cents' => $price]], PaymentRules::onlineDue($visit, null, null, null, []));
        $this->assertSame([], PaymentRules::onlineDue($visit, null, null, null, [$this->pay('full', '600000')]));

        $meetup = $this->d(['payment_method' => 'bank_transfer', 'arrangement_kind' => 'meetup', 'downpayment_amount' => '50000', 'final_price' => '600000']);
        $this->assertSame([['kind' => 'downpayment', 'label' => 'Downpayment', 'cents' => $dp]], PaymentRules::onlineDue($meetup, null, null, 'approved', []));
        $this->assertSame(
            [['kind' => 'balance', 'label' => 'Balance', 'cents' => $price - $dp]],
            PaymentRules::onlineDue($meetup, null, null, 'signed', [$this->pay('downpayment', '50000'), $this->pay('downpayment', '1000', true, true)]),
        );

        $delivery = $this->d(['payment_method' => 'bank_transfer', 'arrangement_kind' => 'delivery', 'delivery_fee' => '2500', 'downpayment_amount' => '50000', 'downpayment_due_at' => '2033-03-01', 'final_price' => '600000']);
        $this->assertSame(
            [['kind' => 'delivery_fee', 'label' => 'Delivery Fee', 'cents' => 250_000], ['kind' => 'downpayment', 'label' => 'Downpayment', 'cents' => $dp]],
            PaymentRules::onlineDue($delivery, null, null, 'approved', []),
        );
        // The delivery fee never reduces the price.
        $this->assertSame(
            [['kind' => 'balance', 'label' => 'Balance', 'cents' => $price - $dp]],
            PaymentRules::onlineDue($delivery, null, null, 'signed', [$this->pay('downpayment', '50000'), $this->pay('delivery_fee', '2500')]),
        );
        $this->assertSame([], PaymentRules::onlineDue($this->d(['payment_method' => 'cash', 'arrangement_kind' => 'gce_visit', 'final_price' => '600000']), null, null, null, []));
    }

    #[Test]
    public function financing_downpayment_is_due_online_once_the_car_is_claimed(): void
    {
        $visit = $this->d(['payment_method' => 'financing', 'arrangement_kind' => 'gce_visit', 'final_price' => '600000']);
        $terms = (object) ['down_payment' => '120000.00', 'state' => 'approved'];
        $this->assertSame([['kind' => 'downpayment', 'label' => 'Downpayment', 'cents' => 12_000_000]], PaymentRules::onlineDue($visit, $terms, 'purchase_claim', null, []));
        $this->assertSame([], PaymentRules::onlineDue($visit, $terms, 'potential_buyer', null, []));
    }

    #[Test]
    public function cash_buy_records_one_due_payment_at_a_time(): void
    {
        $unverified = fn (string $k, string $a, bool $rej = false) => $this->pay($k, $a, false, $rej);
        $visit = $this->d(['payment_method' => 'cash', 'arrangement_kind' => 'gce_visit', 'final_price' => '600000']);
        $this->assertSame(['kind' => 'full', 'cents' => 60_000_000, 'method' => 'cash'], PaymentRules::nextCashDue($visit, [], null));
        $this->assertSame(['kind' => 'balance', 'cents' => 10_000_000, 'method' => 'cash'], PaymentRules::nextCashDue($visit, [$unverified('full', '500000')], null));
        $this->assertNull(PaymentRules::nextCashDue($visit, [$unverified('full', '600000')], null));
        $this->assertSame(['kind' => 'full', 'cents' => 60_000_000, 'method' => 'cash'], PaymentRules::nextCashDue($visit, [$unverified('full', '600000', true)], null));

        $delivery = $this->d(['payment_method' => 'cash', 'arrangement_kind' => 'delivery', 'final_price' => '600000', 'delivery_fee' => '2500', 'downpayment_amount' => '60000', 'downpayment_due_at' => '2033-03-01']);
        $this->assertSame('delivery_fee', PaymentRules::nextCashDue($delivery, [], null)['kind']);
        $this->assertSame(['kind' => 'downpayment', 'cents' => 6_000_000, 'method' => 'cash'], PaymentRules::nextCashDue($delivery, [$unverified('delivery_fee', '2500')], null));
        $this->assertSame(['kind' => 'balance', 'cents' => 54_000_000, 'method' => 'cash'], PaymentRules::nextCashDue($delivery, [$unverified('delivery_fee', '2500'), $unverified('downpayment', '60000')], null));
        $free = clone $delivery;
        $free->delivery_fee = '0';
        $this->assertSame('downpayment', PaymentRules::nextCashDue($free, [], null)['kind']);
        $noTerms = clone $delivery;
        $noTerms->downpayment_due_at = null;
        $this->assertNull(PaymentRules::nextCashDue($noTerms, [], null));

        $this->assertNull(PaymentRules::nextCashDue($this->d(['payment_method' => 'bank_transfer', 'arrangement_kind' => 'gce_visit', 'final_price' => '600000']), [], null));
        $this->assertNull(PaymentRules::nextCashDue(null, [], null));
    }

    #[Test]
    public function large_balances_are_split_at_the_paymongo_limit(): void
    {
        $this->assertSame(['kind' => 'balance', 'label' => 'Balance', 'cents' => PaymentRules::PAYMONGO_MAX_CENTS], PaymentRules::balancePart(PaymentRules::PAYMONGO_MAX_CENTS));
        $first = PaymentRules::balancePart(150_000_000);
        $this->assertSame(PaymentRules::PAYMONGO_MAX_CENTS, $first['cents']);
        $this->assertStringContainsString('501,000', $first['label']);
        $this->assertSame(['kind' => 'balance', 'label' => 'Balance', 'cents' => 50_100_000], PaymentRules::balancePart(150_000_000 - $first['cents']));
    }

    #[Test]
    public function schedule_adds_up_to_the_financed_amount_exactly(): void
    {
        $rows = PaymentRules::schedule(100_000_00, 0, 3, CarbonImmutable::parse('2033-01-31'), 'monthly');
        $this->assertSame([3_333_333, 3_333_333, 3_333_334], array_column($rows, 'cents'));
        $this->assertSame(10_000_000, array_sum(array_column($rows, 'cents')));
        // Month ends clamp like date-fns addMonths: Jan 31 → Feb 28 → Mar 28.
        $this->assertSame(['2033-01-31', '2033-02-28', '2033-03-28'], array_column($rows, 'due_date'));
        $this->assertSame(['2033-01-01', '2033-01-15'], array_column(PaymentRules::schedule(1000, 0, 2, CarbonImmutable::parse('2033-01-01'), 'biweekly'), 'due_date'));
        $this->assertSame([1_000_000], array_column(PaymentRules::schedule(1_200_000, 200_000, 1, CarbonImmutable::parse('2033-01-01'), 'monthly'), 'cents'));
    }

    #[Test]
    public function financing_amounts_match_the_loan_calculator(): void
    {
        // buy-flow.test.ts "T04 financing" and loan-calculator: flat markup to the peso, 10% downpayment, monthly rounded up.
        $this->assertSame(110_000_000, PaymentRules::financedTotal(100_000_000, 10));
        $this->assertSame(54_999_900, PaymentRules::financedTotal(49_999_900, 10));
        $this->assertSame(112_500_000, PaymentRules::financedTotal(100_000_000, 12.5));
        $this->assertSame(100_000_000, PaymentRules::financedTotal(100_000_000, 0));
        $this->assertSame(0, PaymentRules::financedTotal(0, 10));
        $this->assertSame(5_000_000, PaymentRules::downPayment(50_000_000));
        $this->assertSame(5_000_000, PaymentRules::downPayment(49_999_500)); // ₱499,995 × 10% = ₱49,999.50 → ₱50,000
        $this->assertSame(4_583_400, PaymentRules::monthlyInstallment(60_500_000, 5_500_000, 12)); // ₱550,000 / 12 = ₱45,833.33 → ₱45,834
        $this->assertSame(0, PaymentRules::monthlyInstallment(1_000, 2_000, 12));
    }

    #[Test]
    public function unpaid_installments_and_their_states(): void
    {
        $this->assertSame('overdue', PaymentRules::installmentStateFor('2033-01-01', '2033-01-02'));
        $this->assertSame('due', PaymentRules::installmentStateFor('2033-01-02', '2033-01-02'));
        $this->assertSame('upcoming', PaymentRules::installmentStateFor('2033-01-03', '2033-01-02'));
        $rows = [(object) ['id' => 'b', 'state' => 'upcoming', 'due_date' => '2033-03-01'], (object) ['id' => 'a', 'state' => 'overdue', 'due_date' => '2033-02-01'], (object) ['id' => 'c', 'state' => 'paid', 'due_date' => '2033-01-01'], (object) ['id' => 'd', 'state' => 'waived', 'due_date' => '2033-01-15']];
        $this->assertSame(['a', 'b'], PaymentRules::unpaidInstallments($rows)->pluck('id')->all());
    }
}
