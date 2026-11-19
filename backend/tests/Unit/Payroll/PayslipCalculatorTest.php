<?php

namespace Tests\Unit\Payroll;

use App\Services\Payroll\PayslipCalculator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/** Phase 7: the Laravel payslip math matches src/lib/payroll/compute.ts on the shared fixtures, to the cent. */
class PayslipCalculatorTest extends TestCase
{
    public static function fixtures(): array
    {
        $cases = json_decode(file_get_contents(__DIR__.'/../../../../src/lib/payroll/fixtures.json'), true);

        return array_combine(array_column($cases, 'name'), array_map(fn ($c) => [$c['input'], $c['expected']], $cases));
    }

    #[Test]
    #[DataProvider('fixtures')]
    public function matches_the_typescript_helper(array $input, array $expected): void
    {
        $actual = PayslipCalculator::compute($input['baseSalaryCents'], $input['scheduledHoursPerDay'], $input['entries'], $input['overtimeRanges']);
        // JSON has no float/int distinction: 9 hours arrive as int 9.
        $this->assertEquals($expected, $actual);
        foreach (['hourlyRateCents', 'shortMinutes', 'regularCents', 'overtimeCents', 'lateCents'] as $cents) {
            $this->assertSame($expected[$cents], $actual[$cents], $cents);
        }
    }

    #[Test]
    public function scheduled_hours_between_times(): void
    {
        $this->assertSame(9.0, (float) PayslipCalculator::scheduledHours('08:00:00', '17:00:00'));
        $this->assertSame(3.5, PayslipCalculator::scheduledHours('08:30', '12:00'));
    }
}
