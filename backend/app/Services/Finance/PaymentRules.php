<?php

namespace App\Services\Finance;

use App\Services\Trading\BuyRules;
use Carbon\CarbonImmutable;

/**
 * Pure payment rules (was the money half of src/lib/transactions/buy-flow.ts, financing-payments.ts and
 * installments.ts). Every amount is integer centavos; see Money.
 */
final class PaymentRules
{
    /** T10: PayMongo refuses one payment of ₱999,999 or more; larger balances are paid in parts of this much. */
    public const PAYMONGO_MAX_CENTS = 99_900_000;

    private const PRE_DELIVERY_KINDS = ['delivery_fee', 'reschedule_fee', 'downpayment'];

    /** A delivery takes its fee and downpayment before signing; a cash/bank meet-up its downpayment (T04 X2). */
    public static function allowedBeforeSigning(?object $d, ?string $kind): bool
    {
        if (BuyRules::isHalfwayCashRequest($d)) {
            return $kind === 'downpayment';
        }

        return $d?->arrangement_kind === 'delivery' && in_array($kind, self::PRE_DELIVERY_KINDS, true);
    }

    /** Confirmed money toward the car itself; fees and rejected rows never count. */
    public static function verifiedTowardPrice(iterable $payments): int
    {
        return Money::sum(collect($payments)->filter(fn ($p) => $p->verified_by && ! ($p->rejected_at ?? null)
            && ! in_array($p->payment_kind, ['delivery_fee', 'reschedule_fee'], true)));
    }

    /** Recorded money toward the car: unconfirmed cash counts, an unconfirmed installment does not. */
    public static function paidTowardPrice(iterable $payments): int
    {
        return Money::sum(collect($payments)
            ->filter(fn ($p) => ! ($p->rejected_at ?? null) && ! in_array($p->payment_kind, ['delivery_fee', 'reschedule_fee'], true))
            ->filter(fn ($p) => $p->payment_kind !== 'installment' || $p->verified_by));
    }

    public static function verifiedPaid(iterable $payments, string $kind): int
    {
        return Money::sum(collect($payments)->filter(fn ($p) => $p->payment_kind === $kind && $p->verified_by && ! ($p->rejected_at ?? null)));
    }

    /** @return array{kind: string, label: string, cents: int} */
    public static function balancePart(int $remaining): array
    {
        if ($remaining <= self::PAYMONGO_MAX_CENTS) {
            return ['kind' => 'balance', 'label' => 'Balance', 'cents' => $remaining];
        }

        return ['kind' => 'balance', 'label' => 'Balance, part payment (₱'.Money::peso($remaining - self::PAYMONGO_MAX_CENTS).' left after this)', 'cents' => self::PAYMONGO_MAX_CENTS];
    }

    /**
     * What the buyer pays online now: a delivery's fee and downpayment once its terms are set, a financing
     * Initial Downpayment claimed at a GCE visit, or a Bank Transfer's downpayment and then its balance.
     *
     * @param  object|null  $terms  payment_terms row (down_payment, state)
     * @return list<array{kind: string, label: string, cents: int}>
     */
    public static function onlineDue(?object $d, ?object $terms, ?string $flowStatus, ?string $contractState, iterable $payments): array
    {
        $deliveryPair = fn () => array_values(array_filter([
            ['kind' => 'delivery_fee', 'label' => 'Delivery Fee', 'cents' => Money::cents($d?->delivery_fee)],
            ['kind' => 'downpayment', 'label' => 'Downpayment', 'cents' => Money::cents($d?->downpayment_amount)],
        ], fn ($p) => $p['cents'] > 0));

        if ($d?->payment_method === 'bank_transfer') {
            if (! BuyRules::needsContract($d) || $contractState === 'signed') {
                $remaining = Money::cents($d->final_price) - self::verifiedTowardPrice($payments);

                return $remaining > 0 ? [self::balancePart($remaining)] : [];
            }
            if ($d->arrangement_kind === 'delivery' && $d->downpayment_due_at) {
                return $deliveryPair();
            }
            if (self::allowedBeforeSigning($d, 'downpayment')) {
                $cents = Money::cents($d->downpayment_amount);

                return $cents > 0 ? [['kind' => 'downpayment', 'label' => 'Downpayment', 'cents' => $cents]] : [];
            }

            return [];
        }
        if ($d?->arrangement_kind === 'delivery' && $d->downpayment_due_at) {
            return $deliveryPair();
        }
        if ($d?->arrangement_kind === 'gce_visit' && $terms?->state === 'approved' && $flowStatus === 'purchase_claim') {
            $cents = Money::cents($terms->down_payment);

            return $cents > 0 ? [['kind' => 'downpayment', 'label' => 'Downpayment', 'cents' => $cents]] : [];
        }

        return [];
    }

    /**
     * T05: the one payment the Sales Manager records next on a CASH buy (the server decides kind and amount).
     *
     * @return array{kind: string, cents: int, method: string}|null
     */
    public static function nextCashDue(?object $d, iterable $payments, ?string $flowStatus): ?array
    {
        if ($d?->payment_method !== 'cash' || ($d->arrangement_kind === 'delivery' && ! $d->downpayment_due_at)) {
            return null;
        }
        $payments = collect($payments);
        $recorded = fn (string $kind) => $payments->contains(fn ($p) => $p->payment_kind === $kind && ! ($p->rejected_at ?? null));
        if (self::allowedBeforeSigning($d, 'delivery_fee') || self::allowedBeforeSigning($d, 'downpayment')) {
            foreach (self::onlineDue($d, null, $flowStatus, null, $payments) as $due) {
                if (! $recorded($due['kind'])) {
                    return ['kind' => $due['kind'], 'cents' => $due['cents'], 'method' => 'cash'];
                }
            }
        }
        $price = Money::cents($d->final_price);
        $remaining = $price - self::paidTowardPrice($payments);
        if ($remaining <= 0) {
            return null;
        }

        return ['kind' => $remaining === $price ? 'full' : 'balance', 'cents' => $remaining, 'method' => 'cash'];
    }

    /** T04/T06: the car's price plus the financing markup, rounded to the peso (financedTotal). */
    public static function financedTotal(int $priceCents, float|int|string $markupPct): int
    {
        $pesos = \Brick\Math\BigDecimal::ofUnscaledValue($priceCents, 2)
            ->multipliedBy(\Brick\Math\BigDecimal::of((string) $markupPct)->plus(100))
            ->dividedBy(100, 0, \Brick\Math\RoundingMode::HalfUp);

        return $pesos->toInt() * 100;
    }

    /** T05 P7: the Initial Downpayment, 10% of the vehicle price rounded to the peso (downPaymentFor). */
    public static function downPayment(int $priceCents): int
    {
        return \Brick\Math\BigDecimal::ofUnscaledValue($priceCents, 2)->dividedBy(10, 0, \Brick\Math\RoundingMode::HalfUp)->toInt() * 100;
    }

    /** T06: the even monthly installment on what is left after the downpayment, rounded up to the peso. */
    public static function monthlyInstallment(int $totalCents, int $downCents, int $months): int
    {
        return (int) (intdiv(max(0, $totalCents - $downCents) + $months * 100 - 1, $months * 100) * 100);
    }

    /** State an unpaid installment returns to, from its due date ("Y-m-d" strings). */
    public static function installmentStateFor(string $dueDate, string $today): string
    {
        return $dueDate < $today ? 'overdue' : ($dueDate === $today ? 'due' : 'upcoming');
    }

    /** Unpaid installments, earliest due first. */
    public static function unpaidInstallments(iterable $installments): \Illuminate\Support\Collection
    {
        return collect($installments)->reject(fn ($i) => in_array($i->state, ['paid', 'waived'], true))
            ->sortBy(fn ($i) => (string) $i->due_date)->values();
    }

    /**
     * R-19/R-37 schedule: equal installments rounded down to the centavo, the last one takes the remainder,
     * so the schedule adds up to the financed amount exactly.
     *
     * @return list<array{sequence_no: int, due_date: string, cents: int}>
     */
    public static function schedule(int $totalCents, int $downCents, int $count, CarbonImmutable $firstDue, string $frequency): array
    {
        if ($count < 1) {
            throw new \InvalidArgumentException('numberOfPayments must be at least 1');
        }
        if ($totalCents < 0 || $downCents < 0) {
            throw new \InvalidArgumentException('amounts must be non-negative');
        }
        $financed = $totalCents - $downCents;
        $base = intdiv($financed, $count);
        $rows = [];
        $due = $firstDue;
        for ($i = 1; $i <= $count; $i++) {
            $rows[] = ['sequence_no' => $i, 'due_date' => $due->toDateString(), 'cents' => $i === $count ? $financed - $base * ($count - 1) : $base];
            $due = match ($frequency) {
                'weekly' => $due->addWeek(),
                'biweekly' => $due->addWeeks(2),
                'quarterly' => $due->addMonthsNoOverflow(3),
                default => $due->addMonthNoOverflow(),
            };
        }

        return $rows;
    }
}
