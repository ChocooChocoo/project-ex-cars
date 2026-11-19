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
 * Phase 7: clock-in/out and review rules of the replaced Postgres functions (window, grace, geofence, accuracy,
 * leave, workdays, Manila date, Head Security exemption, reviewer roles).
 */
class AttendanceTest extends TestCase
{
    use RefreshDatabase, StaffFixtures;

    /** Monday 23 November 2026, Manila time. */
    private function at(string $manilaTime): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse("2026-11-23 {$manilaTime}", 'Asia/Manila'));
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function clockIn(User $user, array $where = self::AT_GCE)
    {
        return $this->act($user)->postJson('/api/v1/staff/attendance/clock-in', $where);
    }

    #[Test]
    public function on_time_clock_in_uses_the_manila_date_and_grace(): void
    {
        $mechanic = $this->employee('mechanic'); // 07:00–16:00, 10 min grace
        $this->at('07:05'); // 23:05 UTC on the 22nd: the row belongs to the Manila date
        $this->clockIn($mechanic)->assertOk()->assertJsonPath('row.status', 'present')->assertJsonPath('row.attendance_date', '2026-11-23')
            ->assertJsonPath('row.late_minutes', 0)->assertJsonPath('row.applied_grace_minutes', 10);
        $this->act($mechanic)->getJson('/api/v1/staff/attendance/state')->assertJsonPath('state.clock_in_allowed', false)
            ->assertJsonPath('state.clock_in_blocked_reason', 'Already clocked in.')->assertJsonPath('state.local_date', '2026-11-23');
        $this->clockIn($mechanic)->assertStatus(409)->assertJsonPath('message', 'Already clocked in.');

        $this->at('16:00');
        $this->act($mechanic)->postJson('/api/v1/staff/attendance/clock-out')->assertOk()->assertJsonPath('row.hours_worked', 8.92);
        $this->act($mechanic)->getJson('/api/v1/staff/attendance/state')->assertJsonPath('state.clock_in_blocked_reason', 'Attendance already recorded for today.');
        $this->act($mechanic)->postJson('/api/v1/staff/attendance/clock-out')->assertStatus(409)->assertJsonPath('message', 'No open attendance entry.');
    }

    #[Test]
    public function late_after_grace_counts_minutes_up(): void
    {
        $mechanic = $this->employee('mechanic');
        $this->at('07:10:00');
        $this->clockIn($mechanic)->assertJsonPath('row.status', 'present');
        DB::table('attendance_entries')->delete();
        $this->at('07:11:30'); // 1.5 minutes past the deadline → 2
        $this->clockIn($mechanic)->assertJsonPath('row.status', 'late')->assertJsonPath('row.late_minutes', 2);
    }

    #[Test]
    public function window_location_workday_and_leave_rules(): void
    {
        $mechanic = $this->employee('mechanic');
        $this->at('06:29');
        $this->clockIn($mechanic)->assertStatus(422)->assertJsonPath('message', 'Clock In opens at 6:30 AM.');
        $this->act($mechanic)->getJson('/api/v1/staff/attendance/state')->assertJsonPath('state.clock_in_blocked_reason', 'Clock In opens at 6:30 AM.');
        $this->at('16:01');
        $this->clockIn($mechanic)->assertStatus(422)->assertJsonPath('message', 'Clock In closed at 4:00 PM.');

        $this->at('08:00');
        $this->clockIn($mechanic, [...self::AT_GCE, 'accuracy' => 151])->assertStatus(422)->assertJsonPath('message', 'Location is too imprecise. Try near a window.');
        $this->clockIn($mechanic, ['lat' => 14.3290, 'lng' => 120.9536, 'accuracy' => 10])->assertStatus(422) // ~175 m away
            ->assertJsonPath('message', 'You must be at the GCE building to clock in.');
        $this->clockIn($mechanic, ['lat' => 'x', 'lng' => 1, 'accuracy' => 1])->assertStatus(422)->assertJsonPath('message', 'Invalid location.');

        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-29 08:00', 'Asia/Manila')); // Sunday
        $this->clockIn($mechanic)->assertStatus(422)->assertJsonPath('message', 'Today is not a scheduled workday.');

        $this->at('08:00');
        DB::table('employee_requests')->insert(['id' => (string) Str::uuid(), 'employee_id' => $mechanic->id, 'request_kind' => 'leave', 'leave_reason' => 'sick',
            'status' => 'approved', 'start_date' => '2026-11-22', 'end_date' => '2026-11-24', 'created_at' => now(), 'updated_at' => now()]);
        $this->clockIn($mechanic)->assertStatus(422)->assertJsonPath('message', 'Approved leave applies today.');
    }

    #[Test]
    public function untracked_roles_and_missing_schedule(): void
    {
        $this->at('08:00');
        foreach (['head_security', 'customer', 'super_admin'] as $role) {
            $this->clockIn($this->account($role))->assertStatus(403);
        }
        $this->act($this->account('head_security'))->getJson('/api/v1/staff/attendance/state')->assertStatus(403);
        $this->clockIn($this->account('ceo'))->assertStatus(422)->assertJsonPath('message', 'No work schedule is assigned.');
    }

    #[Test]
    public function review_is_for_ceo_am_and_ha_once_after_clock_out(): void
    {
        $mechanic = $this->employee('mechanic');
        $this->at('07:00');
        $id = $this->clockIn($mechanic)->json('row.id');
        $am = $this->account('account_manager');
        $this->act($am)->postJson('/api/v1/staff/attendance/review', ['id' => $id, 'status' => 'present'])->assertStatus(409)
            ->assertJsonPath('message', 'Cannot review attendance while the employee is clocked in.');
        $this->at('16:00');
        $this->act($mechanic)->postJson('/api/v1/staff/attendance/clock-out')->assertOk();

        foreach (['mechanic', 'sales_manager', 'super_admin'] as $role) {
            $this->act($this->account($role))->postJson('/api/v1/staff/attendance/review', ['id' => $id, 'status' => 'present'])->assertStatus(403);
        }
        $this->act($am)->postJson('/api/v1/staff/attendance/review', ['id' => $id, 'status' => 'nope'])->assertStatus(422)->assertJsonPath('message', 'Invalid attendance status.');
        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/attendance/review', ['id' => $id, 'status' => 'half_day', 'notes' => '  '])
            ->assertOk()->assertJsonPath('row.status', 'half_day')->assertJsonPath('row.notes', null);
        $this->act($this->account('ceo'))->postJson('/api/v1/staff/attendance/review', ['id' => $id, 'status' => 'present'])->assertStatus(409)
            ->assertJsonPath('message', 'Attendance has already been checked.');
    }

    #[Test]
    public function history_is_own_rows_or_all_for_reviewers(): void
    {
        $mechanic = $this->employee('mechanic');
        $other = $this->employee('sales_manager');
        $this->at('08:00');
        $this->clockIn($mechanic)->assertOk();
        $this->clockIn($other)->assertOk();
        $this->assertCount(1, $this->act($mechanic)->getJson('/api/v1/staff/attendance')->assertOk()->json('entries'));
        $this->assertCount(2, $this->act($this->account('head_accountant'))->getJson('/api/v1/staff/attendance')->json('entries'));
    }
}
