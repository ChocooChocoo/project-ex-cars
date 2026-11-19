<?php

namespace App\Services\Payroll;

/**
 * Hours-based payslip math, ported line for line from src/lib/payroll/compute.ts.
 *
 * Inputs and outputs are integer cents. The intermediate steps use the same IEEE-754 double arithmetic and
 * Math.round (floor(x + 0.5)) as the TypeScript helper, so every line matches the existing app to the cent;
 * the shared src/lib/payroll/fixtures.json proves it (PayslipCalculatorTest and compute.test.ts).
 * ponytail: float intermediates on purpose (parity with compute.ts); move both sides to exact decimals together.
 */
final class PayslipCalculator
{
    public const DAYS_PER_MONTH = 30;

    public const OVERTIME_MULTIPLIER = 1.25;

    public const DEFAULT_SCHEDULED_HOURS = 8;

    /** JavaScript Math.round for the non-negative values payroll uses. */
    private static function jsRound(float $value): int
    {
        return (int) floor($value + 0.5);
    }

    /** Hours between two TIME values ("HH:MM[:SS]"). */
    public static function scheduledHours(string $start, string $end): float
    {
        $minutes = function (string $time): int {
            [$h, $m] = array_map('intval', explode(':', $time));

            return $h * 60 + $m;
        };

        return ($minutes($end) - $minutes($start)) / 60;
    }

    /**
     * @param  list<array{attendance_date: string, hours_worked: float|int|string|null}>  $entries
     * @param  list<array{start_date: string, end_date: ?string, overtime_hours: float|int|string|null}>  $overtimeRanges
     * @return array{hourlyRateCents: int, regularHours: float, overtimeHours: float, shortMinutes: int, regularCents: int, overtimeCents: int, lateCents: int}
     */
    public static function compute(int $baseSalaryCents, float $scheduledHoursPerDay, array $entries, array $overtimeRanges): array
    {
        $hourlyRateCents = self::jsRound($baseSalaryCents / self::DAYS_PER_MONTH / $scheduledHoursPerDay);
        $scheduledMinutes = self::jsRound($scheduledHoursPerDay * 60);
        // false = no approval for the date; null = legacy request without hours (uncapped); int = approved minutes.
        $approvedMinutes = function (string $date) use ($overtimeRanges): int|null|false {
            $approved = 0;
            $covered = false;
            foreach ($overtimeRanges as $range) {
                if ($date < $range['start_date'] || $date > ($range['end_date'] ?? $range['start_date'])) {
                    continue;
                }
                $covered = true;
                if ($range['overtime_hours'] === null) {
                    return null;
                }
                $approved += self::jsRound((float) $range['overtime_hours'] * 60);
            }

            return $covered ? $approved : false;
        };

        $regularMinutes = $overtimeMinutes = $shortMinutes = 0;
        foreach ($entries as $entry) {
            $worked = self::jsRound((float) ($entry['hours_worked'] ?? 0) * 60);
            if ($worked <= 0) {
                continue;
            }
            $regularMinutes += $scheduledMinutes;
            $shortMinutes += max(0, $scheduledMinutes - $worked);
            $approved = $approvedMinutes($entry['attendance_date']);
            if ($approved !== false) {
                $extra = max(0, $worked - $scheduledMinutes);
                $overtimeMinutes += $approved === null ? $extra : min($extra, $approved);
            }
        }

        $regularHours = $regularMinutes / 60;
        $overtimeHours = $overtimeMinutes / 60;

        return [
            'hourlyRateCents' => $hourlyRateCents,
            'regularHours' => $regularHours,
            'overtimeHours' => $overtimeHours,
            'shortMinutes' => $shortMinutes,
            'regularCents' => self::jsRound($regularHours * $hourlyRateCents),
            'overtimeCents' => self::jsRound($overtimeHours * $hourlyRateCents * self::OVERTIME_MULTIPLIER),
            'lateCents' => self::jsRound(($shortMinutes * $hourlyRateCents) / 60),
        ];
    }
}
