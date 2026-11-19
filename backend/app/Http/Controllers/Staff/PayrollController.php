<?php

namespace App\Http\Controllers\Staff;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Payroll\PayslipCalculator;
use App\Services\Trading\Trading;
use App\Support\ApiRow;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Compensation, payroll runs and payslips (was src/app/(staff)/payroll/actions.ts, payroll/page.tsx, payslips/*).
 * Roles as before: CEO/AM prepare (runs, compensation, payslip lines), Head Accountant then CEO approve, Head
 * Accountant finalizes and pays; employees read their own payslips once finalized. All money is integer cents.
 */
class PayrollController extends Controller
{
    private const PREPARERS = ['ceo', 'account_manager'];

    private const REVIEWERS = ['ceo', 'head_accountant'];

    private const VIEWERS = ['ceo', 'account_manager', 'head_accountant'];

    private static function only(User $user, array $roles, string $message): void
    {
        abort_unless($user->hasRole(...$roles), 403, $message);
    }

    private static function int(mixed $value): int
    {
        return (int) ($value ?? 0);
    }

    private static function runRow(object $r): array
    {
        return ['id' => $r->id, 'period_start' => $r->period_start, 'period_end' => $r->period_end, 'status' => $r->status, 'prepared_by' => $r->prepared_by,
            'total_gross_cents' => self::int($r->total_gross_cents), 'total_deductions_cents' => self::int($r->total_deductions_cents),
            'total_net_cents' => self::int($r->total_net_cents), 'notes' => $r->notes, 'created_at' => ApiRow::iso($r->created_at), 'updated_at' => ApiRow::iso($r->updated_at)];
    }

    private static function itemRow(object $i): array
    {
        return ['id' => $i->id, 'payslip_id' => $i->payslip_id, 'item_kind' => $i->item_kind, 'label' => $i->label, 'amount_cents' => self::int($i->amount_cents),
            'source_value' => $i->source_value, 'calculation_note' => $i->calculation_note];
    }

    /** list_staff_compensation: rows overlapping the period (both bounds optional), oldest first. */
    private static function compensation(?string $start, ?string $end): Collection
    {
        return DB::table('staff_compensation as c')->leftJoin('profiles as p', 'p.id', '=', 'c.employee_id')
            ->when($end, fn ($q) => $q->where('c.effective_from', '<=', $end))
            ->when($start, fn ($q) => $q->where(fn ($w) => $w->whereNull('c.effective_until')->orWhere('c.effective_until', '>=', $start)))
            ->orderBy('c.effective_from')->orderBy('c.created_at')
            ->get(['c.id', 'c.employee_id', 'p.full_name', 'c.base_salary_cents', 'c.effective_from', 'c.effective_until', 'c.sss_contribution_cents',
                'c.pagibig_contribution_cents', 'c.philhealth_contribution_cents', 'c.tin_number', 'c.created_at']);
    }

    /** GET staff/payroll (CEO/AM/HA). */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $employees = $user->hasRole(...self::PREPARERS)
            ? DB::table('profiles as p')->join('user_roles as r', 'r.account_id', '=', 'p.id')->where('r.active', true)->whereIn('r.role', Role::STAFF)
                ->orderBy('p.full_name')->get(['p.id', 'p.full_name'])
            : collect();

        return response()->json([
            'role' => $user->role()->value,
            'runs' => DB::table('payroll_runs')->orderByDesc('created_at')->get()->map(fn ($r) => self::runRow($r)),
            'compensation' => self::compensation(null, null)->map(fn ($c) => [
                'id' => $c->id, 'employee_id' => $c->employee_id, 'full_name' => $c->full_name, 'base_salary_cents' => self::int($c->base_salary_cents),
                'effective_from' => $c->effective_from, 'effective_until' => $c->effective_until, 'sss_contribution_cents' => self::int($c->sss_contribution_cents),
                'pagibig_contribution_cents' => self::int($c->pagibig_contribution_cents), 'philhealth_contribution_cents' => self::int($c->philhealth_contribution_cents),
                'tin_number' => $c->tin_number, 'created_at' => ApiRow::iso($c->created_at),
            ]),
            'employees' => $employees,
        ]);
    }

    /** add_staff_compensation: CEO/AM only, insert only. */
    public function saveCompensation(Request $request): JsonResponse
    {
        $actor = $request->user();
        self::only($actor, self::PREPARERS, 'Permission denied: only the CEO or Account Manager can enter compensation.');
        $data = $request->validate([
            'employee_id' => ['required', 'uuid', 'exists:profiles,id'],
            'base_salary_cents' => ['required', 'integer', 'min:1'],
            'effective_from' => ['required', 'date_format:Y-m-d'],
            'effective_until' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:effective_from'],
            'sss_contribution_cents' => ['nullable', 'integer', 'min:0'],
            'pagibig_contribution_cents' => ['nullable', 'integer', 'min:0'],
            'philhealth_contribution_cents' => ['nullable', 'integer', 'min:0'],
            'tin_number' => ['nullable', 'string', 'max:50'],
        ], ['base_salary_cents.*' => 'Salary must be greater than zero.', 'effective_from.*' => 'Effective date is required.']);
        DB::table('staff_compensation')->insert([
            'id' => (string) Str::uuid(), 'employee_id' => $data['employee_id'], 'base_salary_cents' => $data['base_salary_cents'],
            'effective_from' => $data['effective_from'], 'effective_until' => $data['effective_until'] ?? null,
            'sss_contribution_cents' => $data['sss_contribution_cents'] ?? 0, 'pagibig_contribution_cents' => $data['pagibig_contribution_cents'] ?? 0,
            'philhealth_contribution_cents' => $data['philhealth_contribution_cents'] ?? 0,
            'tin_number' => ($data['tin_number'] ?? '') === '' ? null : $data['tin_number'], 'created_by' => $actor->id, 'created_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }

    /** createPayrollRun: one run per period, one payslip per paid employee, in one transaction. */
    public function createRun(Request $request): JsonResponse
    {
        $actor = $request->user();
        self::only($actor, self::PREPARERS, 'Not authorized to prepare payroll');
        $data = $request->validate([
            'period_start' => ['required', 'date_format:Y-m-d'],
            'period_end' => ['required', 'date_format:Y-m-d', 'after_or_equal:period_start'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], ['period_start.*' => 'Period start is required.', 'period_end.after_or_equal' => 'Period end must be on or after the period start.', 'period_end.*' => 'Period end is required.']);
        [$start, $end] = [$data['period_start'], $data['period_end']];

        try {
            Trading::run(function () use ($actor, $data, $start, $end) {
                $runId = (string) Str::uuid();
                DB::table('payroll_runs')->insert(['id' => $runId, 'period_start' => $start, 'period_end' => $end, 'status' => 'draft', 'prepared_by' => $actor->id,
                    'notes' => ($data['notes'] ?? '') === '' ? null : $data['notes'], 'created_at' => now(), 'updated_at' => now()]);

                // Only checked attendance feeds payroll.
                $entries = DB::table('attendance_entries')->whereBetween('attendance_date', [$start, $end])->whereNotNull('checked_by')
                    ->orderBy('attendance_date')->get(['employee_id', 'attendance_date', 'hours_worked'])->groupBy('employee_id');
                // Latest effective record wins (ordered by effective_from).
                $compensation = self::compensation($start, $end)->keyBy('employee_id');
                $hours = DB::table('employee_work_schedules')->get(['employee_id', 'start_time', 'end_time'])
                    ->mapWithKeys(fn ($s) => [$s->employee_id => PayslipCalculator::scheduledHours($s->start_time, $s->end_time)]);
                $overtime = DB::table('employee_requests')->where('request_kind', 'overtime')->where('status', 'approved')->where('start_date', '<=', $end)
                    ->get(['employee_id', 'start_date', 'end_date', 'overtime_hours'])->groupBy('employee_id');

                $totalGross = $totalDeductions = 0;
                foreach ($entries as $employeeId => $rows) {
                    $comp = $compensation[$employeeId] ?? null;
                    $base = self::int($comp?->base_salary_cents);
                    if ($base === 0) {
                        continue;
                    }
                    $hasSchedule = isset($hours[$employeeId]);
                    $perDay = $hours[$employeeId] ?? PayslipCalculator::DEFAULT_SCHEDULED_HOURS;
                    $pay = PayslipCalculator::compute($base, (float) $perDay,
                        $rows->map(fn ($e) => ['attendance_date' => $e->attendance_date, 'hours_worked' => $e->hours_worked])->all(),
                        ($overtime[$employeeId] ?? collect())->map(fn ($o) => ['start_date' => $o->start_date, 'end_date' => $o->end_date, 'overtime_hours' => $o->overtime_hours])->all());
                    if ($pay['regularHours'] == 0) {
                        continue;
                    }
                    $gross = $pay['regularCents'] + $pay['overtimeCents'];
                    $rate = '₱'.number_format($pay['hourlyRateCents'] / 100, 2, '.', '').'/h';
                    $perDayText = (string) $perDay;
                    $scheduleNote = $hasSchedule ? "{$perDayText} h a day" : "{$perDayText} h a day, no work schedule on file";
                    $regular = number_format($pay['regularHours'], 2, '.', '');
                    $ot = number_format($pay['overtimeHours'], 2, '.', '');
                    $items = array_filter([
                        ['earning', 'Regular hours', $pay['regularCents'], $regular, "{$regular} h × {$rate} (base salary / 30 / {$scheduleNote})"],
                        ['earning', 'Overtime hours', $pay['overtimeCents'], $ot, "{$ot} h × {$rate} × ".PayslipCalculator::OVERTIME_MULTIPLIER.' (approved overtime)'],
                        ['deduction', 'Late / undertime', $pay['lateCents'], (string) $pay['shortMinutes'], "{$pay['shortMinutes']} min × {$rate} ÷ 60 (late arrival and early leave)"],
                    ], fn ($item) => $item[2] > 0);
                    $statutory = array_filter([
                        ['SSS contribution', self::int($comp->sss_contribution_cents)],
                        ['Pag-IBIG contribution', self::int($comp->pagibig_contribution_cents)],
                        ['PhilHealth contribution', self::int($comp->philhealth_contribution_cents)],
                    ], fn ($item) => $item[1] > 0);
                    $deductions = $pay['lateCents'] + array_sum(array_column($statutory, 1));
                    $totalGross += $gross;
                    $totalDeductions += $deductions;

                    $payslipId = (string) Str::uuid();
                    DB::table('payslips')->insert(['id' => $payslipId, 'payroll_run_id' => $runId, 'employee_id' => $employeeId, 'gross_cents' => $gross,
                        'deductions_cents' => $deductions, 'net_cents' => max(0, $gross - $deductions), 'status' => 'draft', 'created_at' => now()]);
                    foreach ($items as [$kind, $label, $cents, $source, $note]) {
                        DB::table('payslip_items')->insert(['id' => (string) Str::uuid(), 'payslip_id' => $payslipId, 'item_kind' => $kind, 'label' => $label,
                            'amount_cents' => $cents, 'source_value' => $source, 'calculation_note' => $note, 'created_at' => now()]);
                    }
                    foreach ($statutory as [$label, $cents]) {
                        DB::table('payslip_items')->insert(['id' => (string) Str::uuid(), 'payslip_id' => $payslipId, 'item_kind' => 'deduction', 'label' => $label,
                            'amount_cents' => $cents, 'source_value' => null, 'calculation_note' => "Auto-computed from the employee's compensation record.", 'created_at' => now()]);
                    }
                }
                DB::table('payroll_runs')->where('id', $runId)->update(['total_gross_cents' => $totalGross, 'total_deductions_cents' => $totalDeductions,
                    'total_net_cents' => $totalGross - $totalDeductions]);
            });
        } catch (\Throwable $e) {
            abort_if(Trading::isUnique($e, 'uq_payroll_period'), 409, 'A payroll run for this period already exists.');
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    /** reviewPayrollRun: Head Accountant approves first (sequence 1), CEO second (2); a rejection sends a pending run back to draft. */
    public function review(Request $request): JsonResponse
    {
        $actor = $request->user();
        self::only($actor, self::REVIEWERS, 'Not authorized to review payroll');
        $data = $request->validate(['payroll_run_id' => ['required', 'uuid'], 'decision' => ['required', 'in:approved,rejected'], 'notes' => ['nullable', 'string', 'max:1000']]);
        $sequence = $actor->hasRole('head_accountant') ? 1 : 2;

        Trading::run(function () use ($actor, $data, $sequence) {
            $run = DB::table('payroll_runs')->where('id', $data['payroll_run_id'])->lockForUpdate()->first();
            abort_unless($run, 404, 'Payroll run not found.');
            $approval = ['id' => (string) Str::uuid(), 'payroll_run_id' => $run->id, 'sequence' => $sequence, 'reviewer_id' => $actor->id,
                'decision' => $data['decision'], 'notes' => ($data['notes'] ?? '') === '' ? null : $data['notes'], 'created_at' => now()];
            if ($data['decision'] === 'rejected') {
                abort_unless($run->status === 'pending_approval', 409, 'Only pending runs can be rejected.');
                DB::table('payroll_runs')->where('id', $run->id)->update(['status' => 'draft', 'updated_at' => now()]);
                DB::table('payroll_approvals')->insert($approval);

                return;
            }
            abort_unless(in_array($run->status, ['draft', 'pending_approval'], true), 409, 'Only draft or pending runs can be approved.');
            $approved = DB::table('payroll_approvals')->where('payroll_run_id', $run->id)->pluck('sequence')->map(fn ($s) => (int) $s)->all();
            abort_if($sequence === 2 && ! in_array(1, $approved, true), 409, 'The Head Accountant must approve the run before the CEO.');
            abort_if(in_array($sequence, $approved, true), 409, 'This step has already been approved.');
            DB::table('payroll_runs')->where('id', $run->id)->update(['status' => $sequence === 2 ? 'approved' : 'pending_approval', 'updated_at' => now()]);
            DB::table('payroll_approvals')->insert($approval);
        });

        return response()->json(['success' => true]);
    }

    public function finalize(Request $request): JsonResponse
    {
        self::only($request->user(), ['head_accountant'], 'Only the Head Accountant can finalize payroll');
        $id = $request->validate(['payroll_run_id' => ['required', 'uuid']])['payroll_run_id'];
        Trading::run(function () use ($id) {
            $run = DB::table('payroll_runs')->where('id', $id)->lockForUpdate()->first();
            abort_unless($run, 404, 'Payroll run not found.');
            abort_unless($run->status === 'approved', 409, 'Only approved runs can be finalized.');
            DB::table('payroll_runs')->where('id', $id)->update(['status' => 'finalized', 'updated_at' => now()]);
            DB::table('payslips')->where('payroll_run_id', $id)->where('status', 'draft')->update(['status' => 'finalized', 'finalized_at' => now()]);
        });

        return response()->json(['success' => true]);
    }

    /** addPayslipItem: CEO/AM on a draft payslip; totals are recomputed from every line. */
    public function addItem(Request $request): JsonResponse
    {
        self::only($request->user(), self::PREPARERS, 'Not authorized to edit payslips');
        $data = $request->validate([
            'payslip_id' => ['required', 'uuid'],
            'item_kind' => ['required', 'in:earning,deduction'],
            'label' => ['required', 'string', 'max:200'],
            'amount_cents' => ['required', 'integer', 'min:0'],
            'source_value' => ['nullable', 'string', 'max:500'],
            'calculation_note' => ['nullable', 'string', 'max:1000'],
        ], ['label.required' => 'Label is required.', 'amount_cents.min' => 'Amount cannot be negative.']);
        Trading::run(function () use ($data) {
            $payslip = DB::table('payslips')->where('id', $data['payslip_id'])->lockForUpdate()->first();
            abort_unless($payslip, 404, 'Payslip not found.');
            abort_unless($payslip->status === 'draft', 409, 'Finalized payslips cannot be edited.');
            DB::table('payslip_items')->insert(['id' => (string) Str::uuid(), 'payslip_id' => $payslip->id, 'item_kind' => $data['item_kind'], 'label' => $data['label'],
                'amount_cents' => $data['amount_cents'], 'source_value' => ($data['source_value'] ?? '') === '' ? null : $data['source_value'],
                'calculation_note' => ($data['calculation_note'] ?? '') === '' ? null : $data['calculation_note'], 'created_at' => now()]);
            $items = DB::table('payslip_items')->where('payslip_id', $payslip->id)->get(['item_kind', 'amount_cents']);
            $gross = (int) $items->where('item_kind', 'earning')->sum(fn ($i) => (int) $i->amount_cents);
            $deductions = (int) $items->where('item_kind', 'deduction')->sum(fn ($i) => (int) $i->amount_cents);
            DB::table('payslips')->where('id', $payslip->id)->update(['gross_cents' => $gross, 'deductions_cents' => $deductions, 'net_cents' => max(0, $gross - $deductions)]);
        });

        return response()->json(['success' => true]);
    }

    public function markPaid(Request $request): JsonResponse
    {
        $actor = $request->user();
        self::only($actor, ['head_accountant'], 'Only the Head Accountant holds salary-payment responsibility');
        $id = $request->validate(['payslip_id' => ['required', 'uuid']])['payslip_id'];
        Trading::run(function () use ($actor, $id) {
            $payslip = DB::table('payslips')->where('id', $id)->lockForUpdate()->first();
            abort_unless($payslip, 404, 'Payslip not found.');
            abort_unless($payslip->status === 'finalized', 409, 'Only finalized payslips can be paid.');
            abort_if($payslip->payment_status === 'paid', 409, 'This payslip is already marked paid.');
            DB::table('payslips')->where('id', $id)->update(['payment_status' => 'paid', 'paid_at' => now(), 'paid_by' => $actor->id]);
        });

        return response()->json(['success' => true]);
    }

    /** getPayrollRunDetail (CEO/AM/HA): payslips with names and lines, approvals with reviewer names. */
    public function runDetail(Request $request, string $id): JsonResponse
    {
        self::only($request->user(), self::VIEWERS, 'Not authorized to view payroll');
        abort_unless(Str::isUuid($id), 422, 'Invalid payroll run.');
        $run = DB::table('payroll_runs')->where('id', $id)->first();
        abort_unless($run, 404, 'Payroll run not found.');
        $payslips = DB::table('payslips as s')->leftJoin('profiles as p', 'p.id', '=', 's.employee_id')->where('s.payroll_run_id', $id)->get(['s.*', 'p.full_name']);
        $items = DB::table('payslip_items')->whereIn('payslip_id', $payslips->pluck('id'))->orderBy('created_at')->get()->groupBy('payslip_id');
        $approvals = DB::table('payroll_approvals as a')->leftJoin('profiles as p', 'p.id', '=', 'a.reviewer_id')->where('a.payroll_run_id', $id)
            ->orderBy('a.created_at')->orderBy('a.sequence')->get(['a.*', 'p.full_name']);

        return response()->json(['run' => self::runRow($run) + [
            'payslips' => $payslips->map(fn ($s) => self::payslipRow($s) + ['profiles' => ['full_name' => $s->full_name],
                'payslip_items' => ($items[$s->id] ?? collect())->map(fn ($i) => self::itemRow($i))->values()]),
            'payroll_approvals' => $approvals->map(fn ($a) => ['id' => $a->id, 'sequence' => (int) $a->sequence, 'decision' => $a->decision, 'notes' => $a->notes,
                'reviewer_id' => $a->reviewer_id, 'created_at' => ApiRow::iso($a->created_at), 'profiles' => ['full_name' => $a->full_name]]),
        ]]);
    }

    private static function payslipRow(object $s): array
    {
        return ['id' => $s->id, 'payroll_run_id' => $s->payroll_run_id, 'employee_id' => $s->employee_id, 'gross_cents' => self::int($s->gross_cents),
            'deductions_cents' => self::int($s->deductions_cents), 'net_cents' => self::int($s->net_cents), 'status' => $s->status,
            'payment_status' => $s->payment_status, 'finalized_at' => ApiRow::iso($s->finalized_at), 'paid_at' => ApiRow::iso($s->paid_at)];
    }

    /** Payslips readable by this user: own finalized ones; CEO/AM/HA read every payslip (payslips RLS). */
    private static function readable(User $user): Builder
    {
        return DB::table('payslips as s')->join('payroll_runs as r', 'r.id', '=', 's.payroll_run_id')
            ->when(! $user->hasRole(...self::VIEWERS), fn ($q) => $q->where('s.employee_id', $user->id)->where('s.status', 'finalized'))
            ->select(['s.*', 'r.period_start', 'r.period_end']);
    }

    private static function tableRow(object $s): array
    {
        return ['id' => $s->id, 'period_start' => $s->period_start, 'period_end' => $s->period_end, 'gross_cents' => self::int($s->gross_cents),
            'net_cents' => self::int($s->net_cents), 'status' => $s->status, 'payment_status' => $s->payment_status];
    }

    /** GET staff/payslips: the Head Accountant sees all; CEO/AM a summary, their own and all; others their own. */
    public function payslips(Request $request): JsonResponse
    {
        $user = $request->user();
        $all = fn () => self::readable($user)->orderByDesc('s.created_at')->get()->map(fn ($s) => self::tableRow($s));
        $own = fn () => self::readable($user)->where('s.employee_id', $user->id)->orderByDesc('s.created_at')->get()->map(fn ($s) => self::tableRow($s));
        $view = $user->hasRole('head_accountant') ? 'all' : ($user->hasRole(...self::PREPARERS) ? 'summary' : 'own');

        return response()->json([
            'view' => $view,
            'userId' => $user->id,
            'rows' => $view === 'all' ? $all() : ($view === 'own' ? $own() : []),
            'ownRows' => $view === 'summary' ? $own() : [],
            'allRows' => $view === 'summary' ? $all() : [],
            'payrollRuns' => $view === 'summary' ? DB::table('payroll_runs')->orderByDesc('created_at')->limit(20)->get()->map(fn ($r) => [
                'id' => $r->id, 'period_start' => $r->period_start, 'period_end' => $r->period_end, 'status' => $r->status,
                'total_gross_cents' => self::int($r->total_gross_cents), 'total_net_cents' => self::int($r->total_net_cents)]) : [],
        ]);
    }

    /** GET staff/payslips/{id}: own finalized payslip, or any for CEO/AM/HA. Lines follow the payslip's access. */
    public function payslip(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $payslip = Str::isUuid($id) ? self::readable($user)->where('s.id', $id)->first() : null;
        abort_unless($payslip, 404, 'Payslip not found.');
        $items = DB::table('payslip_items')->where('payslip_id', $id)->orderBy('created_at')->get()->map(fn ($i) => self::itemRow($i));

        return response()->json([
            'role' => $user->role()->value,
            'isEmployee' => $payslip->employee_id === $user->id,
            'payslip' => self::payslipRow($payslip) + ['period_start' => $payslip->period_start, 'period_end' => $payslip->period_end],
            'items' => $items,
        ]);
    }

    /** The CEO/AM "View all payslips" drill-down is audited (was a browser insert into audit_events). */
    public function drilldown(Request $request): JsonResponse
    {
        $user = $request->user();
        self::only($user, self::PREPARERS, 'Not authorized to view payroll');
        $recordId = $request->validate(['record_id' => ['nullable', 'uuid']])['record_id'] ?? $user->id;
        Trading::audit($user->id, 'payslip_drilldown', 'payslip', $recordId, "Payslip drilldown by {$user->id} to view all payslips");

        return response()->json(['success' => true]);
    }
}
