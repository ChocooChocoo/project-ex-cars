<?php

namespace App\Services\Finance;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

/**
 * Exact peso amounts. Money is compared and added as integer centavos, never as binary floats: the columns are
 * DECIMAL(12,2), and float sums of such values drift (0.1 + 0.2). Convert at the edges with cents()/decimal().
 */
final class Money
{
    /** "600000.50", 600000.5, 600000, null → 60000050 centavos. Half-up to the centavo. */
    public static function cents(mixed $amount): int
    {
        if ($amount === null || $amount === '') {
            return 0;
        }

        return BigDecimal::of(is_float($amount) ? (string) $amount : $amount)
            ->toScale(2, RoundingMode::HalfUp)
            ->multipliedBy(100)
            ->toInt();
    }

    /** 60000050 → "600000.50", the form the DECIMAL(12,2) columns take. */
    public static function decimal(int $cents): string
    {
        return (string) BigDecimal::ofUnscaledValue($cents, 2);
    }

    /** Sum of one field over rows, in centavos. */
    public static function sum(iterable $rows, string $field = 'amount'): int
    {
        $total = 0;
        foreach ($rows as $row) {
            $total += self::cents(is_array($row) ? ($row[$field] ?? null) : ($row->{$field} ?? null));
        }

        return $total;
    }

    /** "600,000" or "600,000.50", as the TypeScript code printed toLocaleString("en-PH"). */
    public static function peso(int $cents): string
    {
        return number_format(intdiv($cents, 100) + ($cents % 100) / 100, $cents % 100 === 0 ? 0 : 2);
    }

    /** "₱600,000.00", as formatCurrency() in src/lib/utils.ts printed it. */
    public static function currency(int $cents): string
    {
        return '₱'.number_format(intdiv($cents, 100) + ($cents % 100) / 100, 2);
    }
}
