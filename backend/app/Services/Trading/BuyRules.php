<?php

namespace App\Services\Trading;

use Carbon\CarbonImmutable;

/** PHP port of the pure rules in src/lib/transactions/buy-flow.ts and state-machine.ts that the server checks. */
final class BuyRules
{
    public const SLOT_RULE_MESSAGE = 'Please choose a time on the hour, between 9 AM and 9 PM, Monday to Saturday.';

    public const DELIVERY_LEAD_MESSAGE = 'Delivery must be scheduled at least 7 days after your request date.';

    public const DIRECT_PAYMENT_METHODS = ['cash', 'bank_transfer'];

    public const REVIEW_WINDOW_DAYS = 7;

    /** state-machine.ts TRANSITION_RULES: from → to → roles. */
    public const TRANSITION_RULES = [
        'pending' => ['under_review' => ['sales_manager', 'ceo', 'account_manager'], 'cancelled' => ['ceo', 'account_manager']],
        'under_review' => ['approved' => ['sales_manager', 'ceo'], 'rejected' => ['sales_manager', 'ceo'], 'cancelled' => ['ceo']],
        'approved' => ['completed' => ['sales_manager', 'ceo'], 'cancelled' => ['ceo']],
    ];

    public static function canTransition(string $from, string $to, string $role): bool
    {
        return in_array($role, self::TRANSITION_RULES[$from][$to] ?? [], true);
    }

    public static function reviewDueAt(?CarbonImmutable $from = null): CarbonImmutable
    {
        return ($from ?? CarbonImmutable::now())->addDays(self::REVIEW_WINDOW_DAYS);
    }

    /** On the hour, 9 AM to 9 PM, Monday to Saturday, Manila time. */
    public static function isBusinessSlot(CarbonImmutable $at): bool
    {
        $manila = $at->setTimezone('Asia/Manila');

        return (int) $manila->format('i') === 0 && (int) $manila->format('s') === 0 && (int) $manila->format('u') === 0
            && $manila->hour >= 9 && $manila->hour <= 21 && $manila->dayOfWeek !== 0;
    }

    public static function isVisitSlot(CarbonImmutable $at): bool
    {
        return $at->isFuture() && self::isBusinessSlot($at);
    }

    public static function isDeliveryDate(CarbonImmutable $at, ?CarbonImmutable $requestedAt = null): bool
    {
        return $at->greaterThanOrEqualTo(($requestedAt ?? CarbonImmutable::now())->addDays(7));
    }

    /** Buyers may cancel a scheduled meetup or delivery only at least 5 hours before it. */
    public static function canCancelScheduled(mixed $at): bool
    {
        return CarbonImmutable::parse($at)->getTimestamp() - time() >= 5 * 3600;
    }

    /** §3 step 6: a no-show only after 2 hours 30 minutes past the meet-up time. */
    public static function canRecordNoShow(mixed $at): bool
    {
        return time() >= CarbonImmutable::parse($at)->getTimestamp() + 150 * 60;
    }

    public static function rescheduleFee(CarbonImmutable $original, float $deliveryFee): float
    {
        $hoursLeft = ($original->getTimestamp() - time()) / 3600;

        return $hoursLeft > 24 ? 0.0 : round($deliveryFee * 50) / 100;
    }

    /** The first delivery time the buyer booked: the oldest delivery arrangement, cancelled or not. */
    public static function originalDeliverySchedule(iterable $arrangements): ?string
    {
        $deliveries = collect($arrangements)->filter(fn ($r) => $r->arrangement_kind === 'delivery' && $r->schedule)
            ->sortBy(fn ($r) => (string) $r->created_at)->values();

        return $deliveries->isEmpty() ? null : (string) $deliveries[0]->schedule;
    }

    public static function isDirectPayment(?object $d): bool
    {
        return in_array($d?->payment_method, self::DIRECT_PAYMENT_METHODS, true);
    }

    public static function isOnsiteCashRequest(?object $d): bool
    {
        return self::isDirectPayment($d) && $d?->arrangement_kind === 'gce_visit';
    }

    public static function isHalfwayCashRequest(?object $d): bool
    {
        return self::isDirectPayment($d) && $d?->arrangement_kind === 'meetup';
    }

    public static function isFinancingRequest(?object $d): bool
    {
        return $d?->payment_method === 'financing' && in_array($d?->arrangement_kind, ['gce_visit', 'meetup', 'delivery'], true);
    }

    public static function isQueuedRequest(?object $d): bool
    {
        return (self::isDirectPayment($d) && in_array($d?->arrangement_kind, ['meetup', 'delivery'], true)) || self::isFinancingRequest($d);
    }

    public static function isFieldArrangement(?object $d): bool
    {
        return in_array($d?->arrangement_kind, ['meetup', 'delivery'], true);
    }

    public static function needsContract(?object $d): bool
    {
        return self::isFieldArrangement($d) || $d?->payment_method === 'financing';
    }

    public static function signsInApp(?object $d): bool
    {
        return $d?->payment_method === 'financing' && $d?->arrangement_kind !== 'delivery';
    }

    public static function papersReadyForSale(?object $d, ?object $handover): bool
    {
        return $handover?->papers_status === (self::isFieldArrangement($d) ? 'handed_over' : 'received');
    }

    /** @return list<string> */
    public static function missingContractCopies(?object $d, ?object $handover): array
    {
        $missing = [];
        if (self::isFieldArrangement($d) && ! $handover?->ci_copy_at) {
            $missing[] = 'Confidential Informant';
        }
        if (self::isHalfwayCashRequest($d) && ! $handover?->mechanic_copy_at) {
            $missing[] = 'Mechanic';
        }

        return $missing;
    }

    public static function contractReadyForSale(?object $d, ?object $handover): bool
    {
        return ! self::needsContract($d) || ($handover?->contract_state === 'signed' && self::missingContractCopies($d, $handover) === []);
    }

    /** Money paid toward the car and confirmed by GCE; fees and rejected payments never count. */
    public static function verifiedTowardPrice(iterable $payments): float
    {
        return \App\Services\Finance\PaymentRules::verifiedTowardPrice($payments) / 100;
    }

    /** Summed in centavos (Money), so many DECIMAL rows add up exactly before the float comparison. */
    public static function verifiedPaid(iterable $payments, string $kind): float
    {
        return \App\Services\Finance\Money::sum(collect($payments)->filter(fn ($p) => $p->payment_kind === $kind && $p->verified_by)) / 100;
    }

    public static function upfrontPaymentsCleared(?object $d, iterable $payments): bool
    {
        return self::verifiedPaid($payments, 'delivery_fee') >= (float) ($d?->delivery_fee ?? 0)
            && self::verifiedPaid($payments, 'downpayment') >= (float) ($d?->downpayment_amount ?? 0);
    }

    public static function financingFullyPaid(iterable $installments): bool
    {
        $rows = collect($installments);

        return $rows->isNotEmpty() && $rows->every(fn ($i) => in_array($i->state, ['paid', 'waived'], true));
    }

    /** IDs still in play: a rejected ID frees its place. */
    public static function activeBuyerIds(iterable $documents): array
    {
        return collect($documents)->filter(fn ($d) => $d->document_kind === 'valid_id' && $d->verification_state !== 'rejected')->values()->all();
    }

    /** Two different IDs, each with an active front and back (rows without a side keep the old two-ID rule). */
    public static function buyerIdsComplete(iterable $documents): bool
    {
        $ids = self::activeBuyerIds($documents);
        if (collect($ids)->every(fn ($d) => $d->id_side === null)) {
            return count($ids) >= 2;
        }
        $sides = [];
        foreach ($ids as $d) {
            if ($d->id_type && $d->id_side) {
                $sides[$d->id_type][$d->id_side] = true;
            }
        }

        return count(array_filter($sides, fn ($s) => isset($s['front'], $s['back']))) >= 2;
    }

    /** Appendix C: 2 no-shows, or any Not Legit decline, restrict the buyer to GCE Visit only. */
    public static function nextStanding(?array $current, string $event): array
    {
        $base = [
            'no_show_count' => (int) ($current['no_show_count'] ?? 0),
            'strike_count' => (int) ($current['strike_count'] ?? 0),
            'gce_visit_only' => (bool) ($current['gce_visit_only'] ?? false),
        ];
        if ($event === 'strike') {
            return ['strike_count' => $base['strike_count'] + 1, 'gce_visit_only' => true] + $base;
        }
        $noShows = $base['no_show_count'] + 1;

        return ['no_show_count' => $noShows, 'gce_visit_only' => $base['gce_visit_only'] || $noShows >= 2] + $base;
    }

    /** §4 step 7a: Dispatched → In Transit → Arriving → Delivered. */
    public static function nextDeliveryStatus(?string $current): ?string
    {
        $all = ['dispatched', 'in_transit', 'arriving', 'delivered'];
        if ($current === null) {
            return 'dispatched';
        }
        $i = array_search($current, $all, true);

        return $i === false ? null : ($all[$i + 1] ?? null);
    }

    /** §4 step 5a: N working days, weekends skipped. */
    public static function addWorkingDays(CarbonImmutable $from, int $days): CarbonImmutable
    {
        $result = $from;
        $added = 0;
        while ($added < $days) {
            $result = $result->addDay();
            if (! $result->isWeekend()) {
                $added++;
            }
        }

        return $result;
    }
}
