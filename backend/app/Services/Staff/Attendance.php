<?php

namespace App\Services\Staff;

use App\Models\AttendanceEntry;
use App\Models\User;
use App\Services\Trading\Trading;
use App\Support\ApiRow;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Staff attendance (was the get_my_attendance_state, clock_in_attendance, clock_out_attendance and review_attendance
 * Postgres functions, latest in 20261031120000_t06_attendance_window_geofence.sql, 20261029130000_t04_head_security_attendance_exemption.sql
 * and 20260809134551_task18_staff_attendance.sql). Same rule order and messages.
 *
 * Locking: pg_advisory_xact_lock(actor) becomes SELECT … FOR UPDATE on the actor's profiles row. That row exists
 * before any attendance row, so two first clock-ins of the day queue on it too; the unique
 * (employee_id, attendance_date) key stays as the backstop.
 */
final class Attendance
{
    public const TZ = 'Asia/Manila';

    public const STATUSES = ['present', 'absent', 'late', 'half_day', 'on_leave'];

    public const REVIEWERS = ['ceo', 'account_manager', 'head_accountant'];

    /** GCE building (private.gce_distance_m). */
    private const GCE_LAT = 14.3274076;

    private const GCE_LNG = 120.9535899;

    private const GEOFENCE_M = 100;

    private const MAX_ACCURACY_M = 150;

    /** Roles that never clock in (Head Security is exempt; customers and Super Admin are not staff). */
    private const UNTRACKED = ['customer', 'head_security', 'super_admin'];

    private static function guard(User $actor): void
    {
        $role = $actor->role()?->value;
        abort_if($role === null || in_array($role, self::UNTRACKED, true) || ! $actor->isActive(), 403, 'Permission denied: active staff role required.');
    }

    public static function localDate(CarbonImmutable $now): string
    {
        return $now->setTimezone(self::TZ)->toDateString();
    }

    /** Haversine distance in metres from the GCE building, Earth radius 6,371,000 m. */
    public static function distanceM(float $lat, float $lng): float
    {
        $dLat = deg2rad($lat - self::GCE_LAT) / 2;
        $dLng = deg2rad($lng - self::GCE_LNG) / 2;
        $a = sin($dLat) ** 2 + cos(deg2rad(self::GCE_LAT)) * cos(deg2rad($lat)) * sin($dLng) ** 2;

        return 2 * 6371000 * asin(sqrt($a));
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} scheduled start and end on a Manila date, in UTC */
    private static function shift(object $schedule, string $localDate): array
    {
        $at = fn (string $time) => CarbonImmutable::parse("{$localDate} {$time}", $schedule->timezone ?? self::TZ)->utc();

        return [$at($schedule->start_time), $at($schedule->end_time)];
    }

    /** private.clock_in_window_reason: opens 30 minutes before the shift, closes at its end. */
    public static function windowReason(CarbonImmutable $now, CarbonImmutable $start, CarbonImmutable $end): ?string
    {
        $opens = $start->subMinutes(30);
        if ($now->lt($opens)) {
            return 'Clock In opens at '.$opens->setTimezone(self::TZ)->format('g:i A').'.';
        }
        if ($now->gt($end)) {
            return 'Clock In closed at '.$end->setTimezone(self::TZ)->format('g:i A').'.';
        }

        return null;
    }

    private static function onLeave(string $employeeId, string $localDate): bool
    {
        return DB::table('employee_requests')->where('employee_id', $employeeId)->where('request_kind', 'leave')->where('status', 'approved')
            ->where('start_date', '<=', $localDate)->whereRaw('COALESCE(end_date, start_date) >= ?', [$localDate])->exists();
    }

    private static function workday(object $schedule, CarbonImmutable $now): bool
    {
        $days = is_array($schedule->workdays) ? $schedule->workdays : (array) json_decode((string) $schedule->workdays, true);

        return in_array($now->setTimezone(self::TZ)->isoWeekday(), array_map('intval', $days), true);
    }

    private static function openEntry(string $employeeId, bool $lock = false): ?AttendanceEntry
    {
        $query = AttendanceEntry::query()->where('employee_id', $employeeId)->whereNotNull('time_in')->whereNull('time_out')
            ->orderByDesc('time_in')->orderByDesc('created_at');

        return ($lock ? $query->lockForUpdate() : $query)->first();
    }

    private static function scheduleRow(string $employeeId): ?object
    {
        return DB::table('employee_work_schedules')->where('employee_id', $employeeId)->first();
    }

    /** get_my_attendance_state. */
    public static function state(User $actor): array
    {
        self::guard($actor);
        $now = CarbonImmutable::now();
        $date = self::localDate($now);
        $schedule = self::scheduleRow($actor->id);
        $today = AttendanceEntry::query()->where('employee_id', $actor->id)->where('attendance_date', $date)->orderByDesc('created_at')->first();
        $open = self::openEntry($actor->id);
        $attendance = $open ?? $today;

        $reason = null;
        if (! $schedule) {
            $reason = 'No work schedule is assigned.';
        } elseif (! self::workday($schedule, $now)) {
            $reason = 'Today is not a scheduled workday.';
        } elseif (self::onLeave($actor->id, $date)) {
            $reason = 'Approved leave applies today.';
        } elseif ($window = self::windowReason($now, ...self::shift($schedule, $date))) {
            $reason = $window;
        } elseif ($open) {
            $reason = $open->checked_by ? 'Attendance has already been checked.' : 'Already clocked in.';
        } elseif ($today) {
            $reason = $today->checked_by ? 'Attendance has already been checked.' : 'Attendance already recorded for today.';
        }

        return [
            'now' => $now->utc()->toIso8601ZuluString('microsecond'),
            'local_date' => $date,
            'attendance' => ApiRow::of($attendance),
            'schedule' => $schedule ? [
                'id' => $schedule->id, 'employee_id' => $schedule->employee_id,
                'workdays' => array_map('intval', is_array($schedule->workdays) ? $schedule->workdays : (array) json_decode((string) $schedule->workdays, true)),
                'start_time' => substr((string) $schedule->start_time, 0, 8), 'end_time' => substr((string) $schedule->end_time, 0, 8),
                'grace_minutes' => (int) $schedule->grace_minutes, 'timezone' => $schedule->timezone,
            ] : null,
            'clock_in_allowed' => $attendance === null && $reason === null,
            'clock_in_blocked_reason' => $reason,
        ];
    }

    /** clock_in_attendance(p_lat, p_lng, p_accuracy). */
    public static function clockIn(User $actor, float $lat, float $lng, ?float $accuracy): AttendanceEntry
    {
        self::guard($actor);

        return Trading::run(function () use ($actor, $lat, $lng, $accuracy) {
            DB::table('profiles')->where('id', $actor->id)->lockForUpdate()->first();
            $now = CarbonImmutable::now();
            $date = self::localDate($now);

            if ($open = self::openEntry($actor->id, lock: true)) {
                abort(409, $open->checked_by ? 'Attendance has already been checked.' : 'Already clocked in.');
            }
            $schedule = DB::table('employee_work_schedules')->where('employee_id', $actor->id)->sharedLock()->first();
            abort_unless($schedule, 422, 'No work schedule is assigned.');
            abort_unless(self::workday($schedule, $now), 422, 'Today is not a scheduled workday.');
            abort_if(self::onLeave($actor->id, $date), 422, 'Approved leave applies today.');
            $today = AttendanceEntry::query()->where('employee_id', $actor->id)->where('attendance_date', $date)->lockForUpdate()->first();
            if ($today) {
                abort(409, $today->checked_by ? 'Attendance has already been checked.' : ($today->time_in ? 'Already clocked in.' : 'Attendance already recorded for today.'));
            }

            [$start, $end] = self::shift($schedule, $date);
            if ($window = self::windowReason($now, $start, $end)) {
                abort(422, $window);
            }
            abort_if($accuracy !== null && $accuracy > self::MAX_ACCURACY_M, 422, 'Location is too imprecise. Try near a window.');
            $distance = self::distanceM($lat, $lng);
            abort_if($distance > self::GEOFENCE_M, 422, 'You must be at the GCE building to clock in.');

            $grace = (int) $schedule->grace_minutes;
            $deadline = $start->addMinutes($grace);
            $entry = new AttendanceEntry;
            $entry->forceFill([
                'employee_id' => $actor->id, 'attendance_date' => $date, 'time_in' => $now,
                'status' => $now->lte($deadline) ? 'present' : 'late',
                'scheduled_start_at' => $start, 'scheduled_end_at' => $end, 'applied_grace_minutes' => $grace,
                'schedule_timezone' => self::TZ,
                'late_minutes' => max(0, (int) ceil(($now->getTimestamp() + $now->micro / 1e6 - $deadline->getTimestamp()) / 60)),
                'clock_in_lat' => $lat, 'clock_in_lng' => $lng, 'clock_in_distance_m' => $distance,
            ]);
            try {
                $entry->save();
            } catch (\Throwable $e) {
                abort_if(Trading::isUnique($e, 'uq_attendance_employee_date'), 409, 'Already clocked in.');
                throw $e;
            }

            return $entry->fresh();
        });
    }

    /** clock_out_attendance(). */
    public static function clockOut(User $actor): AttendanceEntry
    {
        self::guard($actor);

        return Trading::run(function () use ($actor) {
            $open = self::openEntry($actor->id, lock: true);
            abort_unless($open, 409, 'No open attendance entry.');
            abort_if($open->checked_by, 409, 'Attendance has already been checked.');
            $open->forceFill(['time_out' => CarbonImmutable::now()])->save();

            return $open->fresh();
        });
    }

    /** review_attendance(entry_id, status, notes): CEO, Account Manager or Head Accountant, once, after clock-out. */
    public static function review(User $actor, string $entryId, string $status, ?string $notes): AttendanceEntry
    {
        abort_unless($actor->hasRole(...self::REVIEWERS) && $actor->isActive(), 403, 'Permission denied: attendance reviewer role required.');
        abort_unless(in_array($status, self::STATUSES, true), 422, 'Invalid attendance status.');

        return Trading::run(function () use ($actor, $entryId, $status, $notes) {
            $entry = AttendanceEntry::query()->whereKey($entryId)->lockForUpdate()->first();
            abort_unless($entry, 404, 'Attendance entry not found.');
            abort_if($entry->checked_by, 409, 'Attendance has already been checked.');
            abort_if($entry->time_in && ! $entry->time_out, 409, 'Cannot review attendance while the employee is clocked in.');
            $notes = trim((string) $notes);
            $entry->forceFill(['status' => $status, 'notes' => $notes === '' ? null : $notes, 'checked_by' => $actor->id, 'checked_at' => CarbonImmutable::now()])->save();

            return $entry->fresh();
        });
    }
}
