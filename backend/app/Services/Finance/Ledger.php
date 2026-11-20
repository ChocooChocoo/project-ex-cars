<?php

namespace App\Services\Finance;

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * SN-10: the cash ledger. Money movements post themselves into `financial_entries` as the workflow step happens,
 * so the Finance page's "Cash on hand" and "Movements" reflect what GCE actually did.
 *
 * SIGN CONVENTION — one direction per entry kind, applied everywhere (SQL sum, API rows, the Finance page):
 *
 *     revenue      +amount_cents   money in  (a buyer payment was verified)
 *     adjustment   +amount_cents   money in  (a fund's excess cash came back)
 *     expense      -amount_cents   money out (a filed field expense was reimbursed)
 *     disbursement -amount_cents   money out (a fund request was released)
 *
 * `amount_cents` therefore always stores a positive magnitude and `+amount_cents`/`-amount_cents` is the effect,
 * which is why the column keeps its non-negative CHECK. Cash on hand = app_settings.finance_opening_cents (0 when
 * unset) plus those effects.
 *
 * Every automatic post takes a deterministic `idempotency_key` (`<action>:<source row id>`). The key has a unique
 * index, so a retried release, return confirmation, reimbursement or payment verification cannot post twice, even
 * when two requests race: the loser's insert fails and this method reports that nothing was written.
 */
final class Ledger
{
    /** Entry kinds that increase cash on hand; every other kind is an outflow. */
    public const INFLOW = ['revenue', 'adjustment'];

    public const OUTFLOW = ['expense', 'disbursement'];

    public const KINDS = ['revenue', 'expense', 'disbursement', 'adjustment'];

    /** +1 when the kind puts money in the drawer, -1 when it takes money out. */
    public static function sign(string $kind): int
    {
        return in_array($kind, self::INFLOW, true) ? 1 : -1;
    }

    /** The signed cash effect of one entry, in centavos. */
    public static function effect(string $kind, int $amountCents): int
    {
        return self::sign($kind) * abs($amountCents);
    }

    /**
     * Posts one automatic entry and returns the row id, or null when this source action was already posted
     * (or the amount is zero, which is not a movement). Call inside the workflow's transaction, after its own
     * lock, so the row lands with the state change it describes.
     */
    public static function post(
        string $kind,
        int $cents,
        string $description,
        string $idempotencyKey,
        string $recordedBy,
        ?string $transactionId = null,
        ?string $fieldCaseId = null,
    ): ?string {
        if (! in_array($kind, self::KINDS, true) || $cents <= 0) {
            return null;
        }
        if (DB::table('financial_entries')->where('idempotency_key', $idempotencyKey)->exists()) {
            return null;
        }
        $id = (string) Str::uuid();
        try {
            DB::table('financial_entries')->insert([
                'id' => $id, 'entry_kind' => $kind, 'amount_cents' => $cents, 'transaction_id' => $transactionId,
                'field_case_id' => $fieldCaseId, 'description' => $description, 'recorded_by' => $recordedBy,
                'recorded_at' => now(), 'created_at' => now(), 'idempotency_key' => $idempotencyKey,
            ]);
        } catch (UniqueConstraintViolationException) {
            return null; // Another request posted this same source action first.
        }

        return $id;
    }

    /** The opening balance the Head Accountant set (centavos); 0 when the setting is missing. */
    public static function openingCents(): int
    {
        $raw = DB::table('app_settings')->where('key', 'finance_opening_cents')->value('value');
        if ($raw === null) {
            return 0;
        }
        $decoded = is_string($raw) ? json_decode($raw, true) : $raw;
        if (is_array($decoded)) {
            $decoded = $decoded['amount_cents'] ?? null;
        }

        return is_numeric($decoded) ? (int) $decoded : 0;
    }

    /** Opening balance plus every posted movement, in centavos. */
    public static function cashOnHandCents(): int
    {
        $in = "'".implode("','", self::INFLOW)."'";
        $out = "'".implode("','", self::OUTFLOW)."'";
        $total = DB::table('financial_entries')->selectRaw(
            "COALESCE(SUM(CASE WHEN entry_kind IN ({$in}) THEN amount_cents WHEN entry_kind IN ({$out}) THEN -amount_cents ELSE 0 END), 0) AS total"
        )->first()?->total;

        return self::openingCents() + (int) $total;
    }
}
