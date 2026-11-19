<?php

namespace App\Http\Controllers\Staff;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Trading\Trading;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Staff records page (was src/app/(staff)/staff-records/page.tsx reads and actions.ts): profiles, schedules,
 * account state and performance reviews. save_staff_record / set_account_state from
 * 20261029130000_t04_head_security_attendance_exemption.sql and 20260809134551_task18_staff_attendance.sql.
 */
class StaffRecordController extends Controller
{
    private const MANAGERS = ['ceo', 'account_manager'];

    /** Gap 5 (decision 19 November 2026): Super Admin changes account state like the other account endpoints. */
    private const STATE_MANAGERS = ['ceo', 'account_manager', 'super_admin'];

    private const ACCOUNT_STATES = ['invited', 'active', 'suspended', 'archived'];

    /** CEO, AM (all reviews) and Sales Manager (own reviews, performance_reviews RLS). */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $staff = DB::table('profiles as p')->join('user_roles as r', 'r.account_id', '=', 'p.id')
            ->leftJoin('employee_work_schedules as s', 's.employee_id', '=', 'p.id')
            ->where('r.active', true)->whereIn('r.role', Role::STAFF)->orderBy('p.full_name')
            ->get(['p.id', 'p.full_name', 'p.phone', 'p.address', 'p.account_state', 'p.created_at', 'r.role', 's.workdays', 's.start_time', 's.end_time', 's.grace_minutes']);

        $reviews = DB::table('performance_reviews as v')->leftJoin('profiles as e', 'e.id', '=', 'v.employee_id')->leftJoin('profiles as w', 'w.id', '=', 'v.reviewer_id')
            ->when(! $user->hasRole(...self::MANAGERS), fn ($q) => $q->where('v.employee_id', $user->id))
            ->orderByDesc('v.created_at')->get(['v.*', 'e.full_name as employee_name', 'w.full_name as reviewer_name']);

        return response()->json([
            'role' => $user->role()->value,
            'accounts' => $staff->map(fn ($p) => [
                'id' => $p->id, 'fullName' => $p->full_name, 'phone' => $p->phone, 'address' => $p->address, 'role' => $p->role,
                'accountState' => $p->account_state, 'joined' => ApiRow::iso($p->created_at), 'schedule' => null,
                'workdays' => $p->workdays === null ? null : array_map('intval', json_decode($p->workdays, true)),
                'startTime' => $p->start_time ? substr($p->start_time, 0, 8) : null, 'endTime' => $p->end_time ? substr($p->end_time, 0, 8) : null,
                'graceMinutes' => $p->grace_minutes === null ? null : (int) $p->grace_minutes,
            ]),
            'employees' => $staff->map(fn ($p) => ['id' => $p->id, 'full_name' => $p->full_name]),
            'reviews' => $reviews->map(fn ($v) => [
                'id' => $v->id, 'employee_id' => $v->employee_id, 'reviewer_id' => $v->reviewer_id,
                'review_period_start' => $v->review_period_start, 'review_period_end' => $v->review_period_end,
                'rating' => $v->rating === null ? null : (int) $v->rating, 'strengths' => $v->strengths,
                'areas_for_improvement' => $v->areas_for_improvement, 'goals' => $v->goals, 'status' => $v->status,
                'acknowledged_at' => ApiRow::iso($v->acknowledged_at), 'created_at' => ApiRow::iso($v->created_at),
                'profiles' => ['full_name' => $v->employee_name], 'reviewers' => ['full_name' => $v->reviewer_name],
            ]),
        ]);
    }

    private static function managerOnly(User $actor): void
    {
        abort_unless($actor->hasRole(...self::MANAGERS), 403, 'Permission denied: staff manager role required.');
    }

    private static function profileRow(string $id): array
    {
        $p = DB::table('profiles')->where('id', $id)->first(['id', 'full_name', 'phone', 'address', 'account_state', 'activated_at', 'created_at', 'updated_at']);

        return ['id' => $p->id, 'full_name' => $p->full_name, 'phone' => $p->phone, 'address' => $p->address, 'account_state' => $p->account_state,
            'activated_at' => ApiRow::iso($p->activated_at), 'created_at' => ApiRow::iso($p->created_at), 'updated_at' => ApiRow::iso($p->updated_at)];
    }

    /** save_staff_record: CEO/AM only (Super Admin stays out: this writes HR schedules). */
    public function save(Request $request): JsonResponse
    {
        $actor = $request->user();
        self::managerOnly($actor);
        $data = $request->validate([
            'account_id' => ['required', 'uuid'],
            'full_name' => ['nullable', 'string', 'max:200'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:500'],
            'workdays' => ['nullable', 'array', 'min:1', 'max:7'],
            'workdays.*' => ['integer', 'between:1,7', 'distinct'],
            'start_time' => ['nullable', 'date_format:H:i,H:i:s'],
            'end_time' => ['nullable', 'date_format:H:i,H:i:s'],
            'grace_minutes' => ['nullable', 'integer', 'between:5,10'],
        ], ['workdays*' => 'Invalid work schedule.', 'start_time.*' => 'Start time is required.', 'end_time.*' => 'End time is required.', 'grace_minutes.*' => 'Invalid work schedule.']);
        abort_if(trim((string) ($data['full_name'] ?? '')) === '', 422, 'Full name is required.');
        $scheduleFields = array_map(fn ($k) => $data[$k] ?? null, ['workdays', 'start_time', 'end_time', 'grace_minutes']);
        $anySchedule = count(array_filter($scheduleFields, fn ($v) => $v !== null)) > 0;
        abort_if($anySchedule && in_array(null, $scheduleFields, true), 422, 'A complete work schedule is required.');
        if ($anySchedule) {
            abort_unless(strtotime($data['start_time']) < strtotime($data['end_time']), 422, 'The shift must start before it ends.');
        }

        $result = Trading::run(function () use ($actor, $data, $anySchedule) {
            $id = $data['account_id'];
            $updated = DB::table('profiles')->where('id', $id)->lockForUpdate()->first(['id']);
            abort_unless($updated, 404, 'Account not found.');
            DB::table('profiles')->where('id', $id)->update([
                'full_name' => $data['full_name'], 'phone' => ($data['phone'] ?? '') === '' ? null : $data['phone'],
                'address' => ($data['address'] ?? '') === '' ? null : $data['address'], 'updated_at' => now(),
            ]);
            $schedule = null;
            if ($anySchedule) {
                $target = DB::table('user_roles')->where('account_id', $id)->where('active', true)->value('role');
                abort_if($target === null || in_array($target, ['customer', 'head_security', 'super_admin'], true), 422, 'Work schedules require an active staff target.');
                $values = ['workdays' => json_encode(array_map('intval', $data['workdays'])), 'start_time' => $data['start_time'], 'end_time' => $data['end_time'],
                    'grace_minutes' => (int) $data['grace_minutes'], 'timezone' => 'Asia/Manila', 'updated_by' => $actor->id, 'updated_at' => now()];
                if (DB::table('employee_work_schedules')->where('employee_id', $id)->exists()) {
                    DB::table('employee_work_schedules')->where('employee_id', $id)->update($values);
                } else {
                    DB::table('employee_work_schedules')->insert($values + ['id' => (string) Str::uuid(), 'employee_id' => $id, 'created_by' => $actor->id, 'created_at' => now()]);
                }
                $s = DB::table('employee_work_schedules')->where('employee_id', $id)->first();
                $schedule = ['id' => $s->id, 'employee_id' => $s->employee_id, 'workdays' => array_map('intval', json_decode($s->workdays, true)),
                    'start_time' => substr($s->start_time, 0, 8), 'end_time' => substr($s->end_time, 0, 8), 'grace_minutes' => (int) $s->grace_minutes, 'timezone' => $s->timezone];
            }
            Trading::audit($actor->id, 'staff_record_saved', 'profiles', $id, "Staff record {$id} saved");

            return ['profile' => self::profileRow($id), 'schedule' => $schedule];
        });

        return response()->json(['row' => $result['profile'], 'schedule' => $result['schedule']]);
    }

    /** set_account_state: CEO, AM or Super Admin. */
    public function accountState(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->hasRole(...self::STATE_MANAGERS), 403, 'Permission denied: staff manager role required.');
        $data = $request->validate(['account_id' => ['required', 'uuid'], 'state' => ['required', 'string']]);
        abort_unless(in_array($data['state'], self::ACCOUNT_STATES, true), 422, 'Invalid account state.');

        $row = Trading::run(function () use ($actor, $data) {
            $id = $data['account_id'];
            $profile = DB::table('profiles')->where('id', $id)->lockForUpdate()->first(['id', 'activated_at']);
            abort_unless($profile, 404, 'Account not found.');
            DB::table('profiles')->where('id', $id)->update([
                'account_state' => $data['state'], 'updated_at' => now(),
                'activated_at' => $data['state'] === 'active' && $profile->activated_at === null ? now() : $profile->activated_at,
            ]);
            Trading::audit($actor->id, 'account_state_'.$data['state'], 'profiles', $id, "Account {$id} state changed to {$data['state']}");

            return self::profileRow($id);
        });

        return response()->json(['row' => $row, 'schedule' => null]);
    }

    private static function reviewFields(Request $request): array
    {
        $data = $request->validate([
            'employee_id' => ['required', 'uuid', 'exists:profiles,id'],
            'review_period_start' => ['required', 'date'],
            'review_period_end' => ['required', 'date', 'after_or_equal:review_period_start'],
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'strengths' => ['nullable', 'string', 'max:2000'],
            'areas_for_improvement' => ['nullable', 'string', 'max:2000'],
            'goals' => ['nullable', 'string', 'max:2000'],
        ], ['review_period_start.*' => 'Period start is required.', 'review_period_end.*' => 'Period end is required.']);
        foreach (['strengths', 'areas_for_improvement', 'goals'] as $field) {
            $data[$field] = ($data[$field] ?? '') === '' ? null : $data[$field];
        }

        return $data + ['rating' => null];
    }

    public function submitReview(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->hasRole(...self::MANAGERS), 403, 'Not authorized to submit performance reviews');
        DB::table('performance_reviews')->insert(self::reviewFields($request) + [
            'id' => (string) Str::uuid(), 'reviewer_id' => $actor->id, 'status' => 'submitted', 'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }

    public function updateReview(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasRole(...self::MANAGERS), 403, 'Not authorized to update performance reviews');
        $id = $request->validate(['review_id' => ['required', 'uuid']])['review_id'];
        $updated = DB::table('performance_reviews')->where('id', $id)->update(self::reviewFields($request) + ['updated_at' => now()]);
        abort_unless($updated || DB::table('performance_reviews')->where('id', $id)->exists(), 404, 'Review not found.');

        return response()->json(['success' => true]);
    }
}
