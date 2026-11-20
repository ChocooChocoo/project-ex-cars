<?php

namespace App\Services\Trading;

use App\Services\NotificationService;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Shared building blocks for the trading, scheduling and field workflows (was src/lib/transactions/*-server.ts
 * plus the Supabase triggers on transactions, viewing_arrangements and vehicles).
 *
 * Every workflow write runs inside run(): one MySQL transaction, rows locked in this order
 * vehicles → transactions → purchase/sell details → viewing_arrangements → field_cases → sale_handovers.
 * Notifications are queued and written after the commit, so a failed notice never undoes a state change.
 */
final class Trading
{
    public const TERMINAL = ['rejected', 'completed', 'cancelled'];

    /** Flow statuses in which a buyer holds the car reserved (buy-flow-server.ts HOLDING_FLOW_STATUSES). */
    public const HOLDING_FLOW_STATUSES = ['purchase_claim', 'initial_dp_awaiting_verification', 'initial_dp_confirmed', 'financing_active'];

    /** @var list<array{0: array, 1: string, 2: string, 3: string, 4: string, 5: string}> */
    private static array $pending = [];

    /** Runs a workflow step in one transaction and sends its notifications after the commit. */
    public static function run(Closure $work): mixed
    {
        self::$pending = [];
        try {
            $result = DB::transaction($work);
        } catch (\Throwable $e) {
            self::$pending = [];
            throw $e;
        }
        $queued = self::$pending;
        self::$pending = [];
        foreach ($queued as [$to, $kind, $title, $body, $referenceId, $referenceTable]) {
            try {
                app(NotificationService::class)->send($to, $kind, $title, $body, $referenceTable, $referenceId);
            } catch (\Throwable $e) {
                Log::warning('Notification not sent', ['kind' => $kind, 'reference' => $referenceId, 'error' => $e->getMessage()]);
            }
        }

        return $result;
    }

    /** @param  array{role?: string, userId?: string}  $to */
    public static function notify(array $to, string $kind, string $title, string $body, string $referenceId, string $referenceTable = 'transactions'): void
    {
        if (DB::transactionLevel() === 0) {
            app(NotificationService::class)->send($to, $kind, $title, $body, $referenceTable, $referenceId);

            return;
        }
        self::$pending[] = [$to, $kind, $title, $body, $referenceId, $referenceTable];
    }

    /** audit_events row (was logAuditEvent in src/lib/auth/audit.ts), in the same transaction as the change. */
    public static function audit(string $actorId, string $action, string $recordKind, string $recordId, string $summary): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::uuid(), 'actor_id' => $actorId, 'action' => $action, 'record_kind' => $recordKind,
            'record_id' => $recordId, 'summary' => $summary, 'created_at' => now(),
        ]);
    }

    /** Active holders of the field roles (was the list_field_case_workers RPC). */
    public static function fieldWorkers(): Collection
    {
        return DB::table('user_roles as r')->join('profiles as p', 'p.id', '=', 'r.account_id')
            ->where('r.active', true)->whereIn('r.role', ['confidential_informant', 'mechanic', 'head_security'])
            ->get(['r.account_id', 'r.role', 'p.full_name']);
    }

    public static function isWorker(?string $id, string $role): bool
    {
        return $id !== null && self::fieldWorkers()->contains(fn ($w) => $w->account_id === $id && $w->role === $role);
    }

    /**
     * SN-4: where the original papers GCE received from the seller are now. A buyer's sale that hands them over
     * marks them `released`; an unsuccessful sale that returns them marks them `on_hold`. Cars bought before the
     * papers were captured have no custody rows, so this changes nothing for them.
     */
    public static function setPapersCustody(string $saleTransactionId, string $state): void
    {
        $vehicleId = DB::table('transactions')->where('id', $saleTransactionId)->value('vehicle_id');
        if ($vehicleId) {
            DB::table('vehicle_document_items')->where('vehicle_id', $vehicleId)->whereNotNull('custody_state')->update(['custody_state' => $state]);
        }
    }

    public static function history(string $transactionId, string $from, string $to, string $actorId, ?string $reason): void
    {
        DB::table('transaction_status_history')->insert([
            'id' => (string) Str::uuid(), 'transaction_id' => $transactionId, 'from_state' => $from, 'to_state' => $to,
            'actor_id' => $actorId, 'reason' => $reason, 'changed_at' => now(),
        ]);
    }

    /** The transaction row, locked for this step. */
    public static function lockTx(string $id): ?object
    {
        return DB::table('transactions')->where('id', $id)->lockForUpdate()->first();
    }

    /**
     * Updates a transaction. Ports guard_transaction_end: an ended request leaves the per-car queue.
     * With $expectState the update only applies while the row is still in that state (returns false otherwise).
     */
    public static function updateTx(string $id, array $changes, ?string $expectState = null): bool
    {
        if (isset($changes['current_state']) && in_array($changes['current_state'], self::TERMINAL, true)) {
            $changes['queue_state'] = null;
        }
        $query = DB::table('transactions')->where('id', $id);
        if ($expectState !== null) {
            $query->where('current_state', $expectState);
        }

        $updated = $query->update($changes + ['updated_at' => now()]) > 0;
        if ($updated && isset($changes['current_state'])) {
            self::syncSupplierPost($id, $changes['current_state']);
        }

        return $updated;
    }

    /**
     * Notes lines 55 and 93: a supplier's post follows the sell transaction GCE opened for it. A completed purchase
     * is "purchased" and leaves the supplier's active list; a cancelled or rejected one is "rejected".
     */
    private static function syncSupplierPost(string $transactionId, string $state): void
    {
        $next = match ($state) {
            'completed' => 'purchased',
            'cancelled', 'rejected' => 'rejected',
            default => null,
        };
        if ($next === null) {
            return;
        }
        $post = DB::table('supplier_vehicle_posts')->where('transaction_id', $transactionId)->where('state', 'assigned')->first(['id', 'supplier_id', 'year', 'make', 'model']);
        if (! $post) {
            return;
        }
        DB::table('supplier_vehicle_posts')->where('id', $post->id)->update(['state' => $next, 'updated_at' => now()]);
        self::notify(['userId' => $post->supplier_id], 'supplier_'.$next, $next === 'purchased' ? 'GCE bought your vehicle' : 'GCE will not buy this vehicle',
            "{$post->year} {$post->make} {$post->model}: ".($next === 'purchased' ? 'GCE paid for it.' : 'the purchase did not go through.'), $post->id, 'supplier_vehicle_posts');
    }

    /** True when the exception is the named unique key (MySQL 1062). */
    public static function isUnique(\Throwable $e, string $key): bool
    {
        return $e instanceof UniqueConstraintViolationException && str_contains($e->getMessage(), $key);
    }

    /**
     * Inserts a viewing arrangement. Ports set_arrangement_vehicle: the car always comes from the
     * transaction (or the inquiry), never from the caller. Returns null, or 'slot_taken' on the slot lock.
     */
    public static function insertArrangement(array $row): ?string
    {
        $vehicleId = null;
        if (! empty($row['purchase_transaction_id'])) {
            $vehicleId = DB::table('transactions')->where('id', $row['purchase_transaction_id'])->value('vehicle_id');
        }
        if (! $vehicleId && ! empty($row['inquiry_id'])) {
            $vehicleId = DB::table('inquiries')->where('id', $row['inquiry_id'])->value('vehicle_id');
        }
        if (! $vehicleId) {
            abort(422, 'This request has no vehicle.');
        }
        // Bookings for one car run one at a time: concurrent inserts into the slot index otherwise deadlock
        // on InnoDB gap locks instead of failing cleanly on the unique key (found by ConcurrencyTest).
        DB::table('vehicles')->where('id', $vehicleId)->lockForUpdate()->first();
        try {
            // A savepoint keeps the surrounding transaction usable after a slot-lock violation.
            DB::transaction(fn () => DB::table('viewing_arrangements')->insert(
                ['id' => (string) Str::uuid(), 'vehicle_id' => $vehicleId, 'created_at' => now()] + $row,
            ));
        } catch (UniqueConstraintViolationException $e) {
            if (self::isUnique($e, 'viewing_arrangements_gce_visit_slot_lock')) {
                return 'slot_taken';
            }
            throw $e;
        }

        return null;
    }

    /** §2: a rejected or cancelled request gives its locked visit slot back. */
    public static function releaseVisitSlots(string $transactionId): void
    {
        DB::table('viewing_arrangements')->where('purchase_transaction_id', $transactionId)
            ->whereIn('confirmation_state', ['pending', 'confirmed'])->update(['confirmation_state' => 'cancelled']);
    }

    /** T10: a car held by a buyer leaves the showroom. Only an available car is reserved. */
    public static function reserveVehicle(?string $vehicleId): void
    {
        if ($vehicleId) {
            DB::table('vehicles')->where('id', $vehicleId)->where('listing_state', 'available')
                ->update(['listing_state' => 'reserved', 'updated_at' => now()]);
        }
    }

    /** A cancelled or rejected buyer who held the car gives it back to the showroom. */
    public static function releaseVehicle(?string $vehicleId, ?string $flowStatus): void
    {
        if ($vehicleId && in_array($flowStatus, self::HOLDING_FLOW_STATUSES, true)) {
            DB::table('vehicles')->where('id', $vehicleId)->where('listing_state', 'reserved')
                ->update(['listing_state' => 'available', 'updated_at' => now()]);
        }
    }

    /**
     * Marks a car sold. Ports guard_financing_sold: a car on an active financing account with unpaid,
     * unwaived installments cannot be sold.
     */
    public static function markVehicleSold(string $vehicleId): void
    {
        $unpaid = DB::table('installment_accounts as a')
            ->join('transactions as t', 't.id', '=', 'a.purchase_transaction_id')
            ->join('installments as i', 'i.account_id', '=', 'a.id')
            ->where('t.vehicle_id', $vehicleId)->where('a.state', 'active')
            ->whereNotIn('i.state', ['paid', 'waived'])->exists();
        if ($unpaid) {
            abort(409, 'This car still has unpaid installments, so it cannot be marked sold.');
        }
        DB::table('vehicles')->where('id', $vehicleId)->update(['listing_state' => 'sold', 'updated_at' => now()]);
    }

    /**
     * §2 step 6, Mark Sold to This Buyer: the car leaves the listings and every other open request for it ends,
     * freeing their slots. Other buyers are told. BC-4: the Head Accountant is told the sale completed, with the
     * car, the buyer, the price and the method, so the payment record reaches them.
     */
    public static function finalizeBuySale(object $sale, string $actorId, bool $keepFlowStatus = false): void
    {
        DB::table('transactions')->where('id', $sale->id)->update(
            ($keepFlowStatus ? ['review_due_at' => null] : ['flow_status' => 'sold', 'review_due_at' => null]) + ['updated_at' => now()],
        );
        DB::table('viewing_arrangements')->where('purchase_transaction_id', $sale->id)
            ->whereIn('confirmation_state', ['pending', 'confirmed'])->update(['confirmation_state' => 'completed']);
        if (! $sale->vehicle_id) {
            return;
        }
        self::markVehicleSold($sale->vehicle_id);
        // Notes line 158: the seller's papers are On Hold while the car is unsold and Released once it sells.
        self::setPapersCustody($sale->id, 'released');
        self::notifySaleCompleted($sale);

        $competitors = DB::table('transactions')->where('vehicle_id', $sale->vehicle_id)->where('transaction_kind', 'buy')
            ->where('id', '!=', $sale->id)->whereIn('current_state', ['pending', 'under_review', 'approved'])
            ->orderBy('id')->lockForUpdate()->get(['id', 'customer_id', 'current_state']);
        foreach ($competitors as $other) {
            self::updateTx($other->id, ['current_state' => 'cancelled', 'completed_at' => now(), 'flow_status' => null, 'review_due_at' => null]);
            self::history($other->id, $other->current_state, 'cancelled', $actorId, 'Vehicle sold to another buyer');
            self::releaseVisitSlots($other->id);
            self::notify(['userId' => $other->customer_id], 'vehicle_sold_elsewhere', 'This car has been sold',
                'The car you requested was sold to another buyer, so your request has been closed.', $other->id);
        }
    }

    /** BC-4: the Head Accountant learns which car sold, to whom, at what price and how it was paid. */
    private static function notifySaleCompleted(object $sale): void
    {
        $details = DB::table('purchase_details')->where('transaction_id', $sale->id)->first();
        $vehicle = DB::table('vehicles')->where('id', $sale->vehicle_id)->first(['make', 'model', 'year', 'stock_code']);
        $buyer = DB::table('profiles')->where('id', $sale->customer_id)->value('full_name');
        $car = $vehicle ? trim($vehicle->year.' '.$vehicle->make.' '.$vehicle->model) : 'A car';
        if ($vehicle?->stock_code) {
            $car .= " ({$vehicle->stock_code})";
        }
        $method = match (true) {
            ($details?->payment_option ?? null) === 'financing' || $details?->payment_method === 'financing' => 'Financing',
            $details?->payment_method === 'bank_transfer' => 'Bank Transfer',
            $details?->payment_method === 'cash' => 'Cash',
            default => 'Not recorded',
        };
        $price = self::peso((float) ($details?->final_price ?? 0));
        self::notify(['role' => 'head_accountant'], 'sale_completed', 'Car sold',
            "{$car} sold to ".($buyer ?: 'the buyer')." for ₱{$price}, paid by {$method}. Record the payment on the transaction.", $sale->id);
    }

    /** Appendix C: no-shows and Not Legit declines go on the buyer's record. */
    public static function recordStandingEvent(string $customerId, string $event, string $actorId): array
    {
        $current = DB::table('customer_standing')->where('account_id', $customerId)->lockForUpdate()->first();
        $next = BuyRules::nextStanding($current ? (array) $current : null, $event);
        DB::table('customer_standing')->updateOrInsert(['account_id' => $customerId], $next + ['updated_by' => $actorId, 'updated_at' => now()]);

        return $next;
    }

    /**
     * T10: moves a delivery to its new time and address: a new arrangement, the field case, the purchase
     * location, a history line, and the new schedule to the Sales Manager and the Confidential Informant.
     */
    public static function applyDeliveryReschedule(object $sale, CarbonImmutable $schedule, string $location, float $fee, string $actorId): void
    {
        DB::table('viewing_arrangements')->where('purchase_transaction_id', $sale->id)->where('arrangement_kind', 'delivery')
            ->whereIn('confirmation_state', ['pending', 'confirmed'])->update(['confirmation_state' => 'cancelled']);
        self::insertArrangement(['purchase_transaction_id' => $sale->id, 'arrangement_kind' => 'delivery', 'schedule' => $schedule, 'location' => $location]);
        DB::table('purchase_details')->where('transaction_id', $sale->id)
            ->update(['location' => $location, 'reschedule_pending_at' => null, 'reschedule_pending_location' => null]);
        $case = DB::table('field_cases')->where('transaction_id', $sale->id)->where('case_kind', 'delivery')->where('state', '!=', 'cancelled')->first();
        if ($case) {
            DB::table('field_cases')->where('id', $case->id)->update(['schedule' => $schedule, 'location' => $location, 'updated_at' => now()]);
        }
        $when = self::when($schedule);
        self::history($sale->id, $sale->current_state, $sale->current_state, $actorId,
            "Delivery moved to {$when} at {$location}".($fee > 0 ? '; fee ₱'.self::peso($fee) : ''));
        $body = "New delivery: {$when} at {$location}.";
        self::notify(['role' => 'sales_manager'], 'delivery_rescheduled', 'Delivery re-scheduled by the buyer', $body, $sale->id);
        if ($case?->assigned_confidential_informant) {
            self::notify(['userId' => $case->assigned_confidential_informant], 'delivery_rescheduled', 'Delivery re-scheduled by the buyer', $body, $sale->id);
        }
    }

    /** meetup-server.ts openMeetupCase: the Meet Halfway field case for the chosen CI and Mechanic. */
    public static function openMeetupCase(object $sale, string $informantId, string $mechanicId, object $meetup, string $actorId): void
    {
        DB::table('field_cases')->insert([
            'id' => (string) Str::uuid(), 'transaction_id' => $sale->id, 'vehicle_id' => $sale->vehicle_id, 'case_kind' => 'buyer_meetup',
            'assigned_confidential_informant' => $informantId, 'mechanic_id' => $mechanicId, 'schedule' => $meetup->schedule,
            'location' => $meetup->location, 'state' => 'assigned', 'notes' => 'Meet Halfway. The Confidential Informant carries the vehicle papers.',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        self::history($sale->id, $sale->current_state, $sale->current_state, $actorId, 'Meet-up team assigned');
        foreach ([$informantId, $mechanicId] as $worker) {
            self::notify(['userId' => $worker], 'field_case_assigned', 'You have a client to meet halfway',
                'Meet the buyer on '.self::when(CarbonImmutable::parse($meetup->schedule, 'UTC')).' at '.($meetup->location ?? 'the agreed place')
                .'. Open the field case for the vehicle and the buyer, and receive it.', $sale->id);
        }
    }

    /** Manila time as the TS code printed it (toLocaleString("en-PH", { timeZone: "Asia/Manila" })). */
    public static function when(mixed $at): string
    {
        return CarbonImmutable::parse($at)->setTimezone('Asia/Manila')->format('n/j/Y, g:i:s A');
    }

    public static function peso(float|int|string|null $amount): string
    {
        $value = (float) ($amount ?? 0);

        return number_format($value, fmod($value, 1.0) === 0.0 ? 0 : 2);
    }

    /** A client time ("2026-11-20T09:00:00+08:00") as UTC, or null when it does not parse. */
    public static function parseTime(mixed $value): ?CarbonImmutable
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        try {
            return CarbonImmutable::parse($value)->utc();
        } catch (\Throwable) {
            return null;
        }
    }
}
