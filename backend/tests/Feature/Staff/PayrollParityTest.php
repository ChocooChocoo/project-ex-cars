<?php

namespace Tests\Feature\Staff;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Staff\Concerns\StaffFixtures;
use Tests\TestCase;

/**
 * Phase 7: a payroll run end to end on MySQL. Totals and every payslip line match the hand-computed fixture
 * (same rules as src/lib/payroll/compute.ts, whose cases PayslipCalculatorTest replays); approval order, period
 * uniqueness, one payslip per employee and run, and compensation/payslip privacy.
 */
class PayrollParityTest extends TestCase
{
    use RefreshDatabase, StaffFixtures;

    private function day(User $employee, string $date, string $in, string $out, ?User $checker): void
    {
        // Times are Manila; stored UTC.
        $utc = fn ($t) => CarbonImmutable::parse("{$date} {$t}", 'Asia/Manila')->utc();
        DB::table('attendance_entries')->insert(['id' => (string) Str::uuid(), 'employee_id' => $employee->id, 'attendance_date' => $date, 'time_in' => $utc($in),
            'time_out' => $utc($out), 'status' => 'present', 'schedule_timezone' => 'Asia/Manila', 'applied_grace_minutes' => 10,
            'checked_by' => $checker?->id, 'checked_at' => $checker ? now() : null, 'created_at' => now()]);
    }

    /** Mechanic, 07:00–16:00 (9 h), ₱27,000 a month = ₱100.00 an hour. */
    private function setUpMonth(): array
    {
        $am = $this->account('account_manager');
        $mechanic = $this->employee('mechanic');
        $this->act($am)->postJson('/api/v1/staff/payroll/compensation', ['employee_id' => $mechanic->id, 'base_salary_cents' => 2_700_000,
            'effective_from' => '2026-01-01', 'sss_contribution_cents' => 50_000, 'tin_number' => ''])->assertOk();
        $this->day($mechanic, '2026-10-01', '07:00', '16:00', $am);   // 9 h
        $this->day($mechanic, '2026-10-02', '07:20', '16:00', $am);   // 8.67 h: 20 min short
        $this->day($mechanic, '2026-10-03', '07:00', '18:00', $am);   // 11 h, overtime approved below
        $this->day($mechanic, '2026-10-05', '07:00', '16:00', null);  // unchecked: not paid
        DB::table('employee_requests')->insert(['id' => (string) Str::uuid(), 'employee_id' => $mechanic->id, 'request_kind' => 'overtime', 'status' => 'approved',
            'start_date' => '2026-10-03', 'overtime_hours' => 2, 'created_at' => now(), 'updated_at' => now()]);

        return [$am, $mechanic];
    }

    #[Test]
    public function run_totals_and_lines_match_the_fixture(): void
    {
        [$am, $mechanic] = $this->setUpMonth();
        $this->act($am)->postJson('/api/v1/staff/payroll/runs', ['period_start' => '2026-10-01', 'period_end' => '2026-10-31'])->assertOk();
        $this->act($this->account('ceo'))->postJson('/api/v1/staff/payroll/runs', ['period_start' => '2026-10-01', 'period_end' => '2026-10-31'])
            ->assertStatus(409)->assertJsonPath('message', 'A payroll run for this period already exists.');

        $run = DB::table('payroll_runs')->first();
        $this->assertSame([295_000, 53_333, 241_667], [(int) $run->total_gross_cents, (int) $run->total_deductions_cents, (int) $run->total_net_cents]);
        $payslip = DB::table('payslips')->where('employee_id', $mechanic->id)->first();
        $this->assertSame([295_000, 53_333, 241_667, 'draft'], [(int) $payslip->gross_cents, (int) $payslip->deductions_cents, (int) $payslip->net_cents, $payslip->status]);
        $lines = DB::table('payslip_items')->where('payslip_id', $payslip->id)->orderBy('label')->get()
            ->map(fn ($i) => [$i->item_kind, $i->label, (int) $i->amount_cents, $i->source_value, $i->calculation_note])->all();
        $this->assertSame([
            ['deduction', 'Late / undertime', 3_333, '20', '20 min × ₱100.00/h ÷ 60 (late arrival and early leave)'],
            ['earning', 'Overtime hours', 25_000, '2.00', '2.00 h × ₱100.00/h × 1.25 (approved overtime)'],
            ['earning', 'Regular hours', 270_000, '27.00', '27.00 h × ₱100.00/h (base salary / 30 / 9 h a day)'],
            ['deduction', 'SSS contribution', 50_000, null, "Auto-computed from the employee's compensation record."],
        ], $lines);
        $this->assertSame(1, DB::table('payslips')->count(), 'one payslip per employee and run');
    }

    #[Test]
    public function approval_order_finalize_payment_and_privacy(): void
    {
        [$am, $mechanic] = $this->setUpMonth();
        $this->act($am)->postJson('/api/v1/staff/payroll/runs', ['period_start' => '2026-10-01', 'period_end' => '2026-10-31'])->assertOk();
        $runId = DB::table('payroll_runs')->value('id');
        $payslipId = DB::table('payslips')->value('id');
        $ceo = $this->account('ceo');
        $ha = $this->account('head_accountant');

        // The employee cannot see a draft payslip; another employee never sees it; Super Admin sees no payroll at all.
        $this->act($mechanic)->getJson("/api/v1/staff/payslips/{$payslipId}")->assertStatus(404);
        $this->act($mechanic)->getJson('/api/v1/staff/payroll')->assertStatus(403);
        $sa = $this->account('super_admin');
        foreach (['/api/v1/staff/payroll', "/api/v1/staff/payslips/{$payslipId}", "/api/v1/staff/payroll/runs/{$runId}"] as $uri) {
            $this->act($sa)->getJson($uri)->assertStatus(403);
        }

        $this->act($am)->postJson('/api/v1/staff/payroll/runs/review', ['payroll_run_id' => $runId, 'decision' => 'approved'])->assertStatus(403);
        $this->act($ceo)->postJson('/api/v1/staff/payroll/runs/review', ['payroll_run_id' => $runId, 'decision' => 'approved'])->assertStatus(409)
            ->assertJsonPath('message', 'The Head Accountant must approve the run before the CEO.');
        $this->act($ha)->postJson('/api/v1/staff/payroll/runs/review', ['payroll_run_id' => $runId, 'decision' => 'approved'])->assertOk();
        $this->act($ha)->postJson('/api/v1/staff/payroll/runs/review', ['payroll_run_id' => $runId, 'decision' => 'approved'])->assertStatus(409)
            ->assertJsonPath('message', 'This step has already been approved.');
        $this->act($ha)->postJson('/api/v1/staff/payroll/runs/finalize', ['payroll_run_id' => $runId])->assertStatus(409);
        $this->act($ceo)->postJson('/api/v1/staff/payroll/runs/review', ['payroll_run_id' => $runId, 'decision' => 'approved'])->assertOk();
        $this->act($ceo)->postJson('/api/v1/staff/payroll/runs/finalize', ['payroll_run_id' => $runId])->assertStatus(403);
        $this->act($ha)->postJson('/api/v1/staff/payroll/runs/finalize', ['payroll_run_id' => $runId])->assertOk();

        $detail = $this->act($ceo)->getJson("/api/v1/staff/payroll/runs/{$runId}")->assertOk();
        $this->assertSame([1, 2], array_column($detail->json('run.payroll_approvals'), 'sequence'));
        $this->assertCount(4, $detail->json('run.payslips.0.payslip_items'));

        // Finalized: the employee reads their own payslip and lines; another employee still cannot.
        $this->act($mechanic)->getJson("/api/v1/staff/payslips/{$payslipId}")->assertOk()->assertJsonPath('isEmployee', true)->assertJsonCount(4, 'items');
        $this->act($this->employee('sales_manager'))->getJson("/api/v1/staff/payslips/{$payslipId}")->assertStatus(404);
        $this->assertCount(1, $this->act($mechanic)->getJson('/api/v1/staff/payslips')->json('rows'));

        $this->act($am)->postJson('/api/v1/staff/payroll/payslip-items', ['payslip_id' => $payslipId, 'item_kind' => 'earning', 'label' => 'Bonus', 'amount_cents' => 1])
            ->assertStatus(409)->assertJsonPath('message', 'Finalized payslips cannot be edited.');
        $this->act($ceo)->postJson('/api/v1/staff/payroll/payslips/mark-paid', ['payslip_id' => $payslipId])->assertStatus(403);
        $this->act($ha)->postJson('/api/v1/staff/payroll/payslips/mark-paid', ['payslip_id' => $payslipId])->assertOk();
        $this->act($ha)->postJson('/api/v1/staff/payroll/payslips/mark-paid', ['payslip_id' => $payslipId])->assertStatus(409)
            ->assertJsonPath('message', 'This payslip is already marked paid.');
        $this->assertSame($ha->id, DB::table('payslips')->where('id', $payslipId)->value('paid_by'));
    }

    #[Test]
    public function draft_lines_recompute_totals_and_compensation_is_private(): void
    {
        [$am, $mechanic] = $this->setUpMonth();
        $this->act($am)->postJson('/api/v1/staff/payroll/runs', ['period_start' => '2026-10-01', 'period_end' => '2026-10-31'])->assertOk();
        $payslipId = DB::table('payslips')->value('id');
        $this->act($am)->postJson('/api/v1/staff/payroll/payslip-items', ['payslip_id' => $payslipId, 'item_kind' => 'earning', 'label' => 'Bonus', 'amount_cents' => 10_000])->assertOk();
        $payslip = DB::table('payslips')->where('id', $payslipId)->first();
        $this->assertSame([305_000, 53_333, 251_667], [(int) $payslip->gross_cents, (int) $payslip->deductions_cents, (int) $payslip->net_cents]);

        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/payroll/compensation', ['employee_id' => $mechanic->id, 'base_salary_cents' => 1, 'effective_from' => '2026-01-01'])
            ->assertStatus(403);
        $this->act($this->account('head_accountant'))->getJson('/api/v1/staff/payroll')->assertOk()->assertJsonPath('compensation.0.base_salary_cents', 2_700_000)
            ->assertJsonPath('employees', []);
        $this->act($mechanic)->getJson('/api/v1/staff/payroll')->assertStatus(403);
        $this->act($am)->postJson('/api/v1/staff/payroll/payslips/drilldown', ['record_id' => $payslipId])->assertOk();
        $this->assertSame(1, DB::table('audit_events')->where('action', 'payslip_drilldown')->where('actor_id', $am->id)->count());
    }
}
