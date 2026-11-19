<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Models\AttendanceEntry;
use App\Services\Staff\Attendance;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Attendance page (was src/app/(staff)/attendance/page.tsx reads and actions.ts). */
class AttendanceController extends Controller
{
    /** Own history (30 rows), or the latest 100 for CEO/AM/HA (attendance_entries RLS), plus the clock state. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $readAll = $user->hasRole(...Attendance::REVIEWERS);
        $rows = AttendanceEntry::query()->with('employee:id,full_name')
            ->when(! $readAll, fn ($q) => $q->where('employee_id', $user->id))
            ->orderByDesc('attendance_date')->limit($readAll ? 100 : 30)->get();

        return response()->json([
            'role' => $user->role()->value,
            'currentUserId' => $user->id,
            'entries' => $rows->map(fn (AttendanceEntry $e) => [
                ...ApiRow::of($e, ['id', 'employee_id', 'attendance_date', 'time_in', 'time_out', 'hours_worked', 'status', 'notes', 'checked_by']),
                'employee_name' => $e->employee?->full_name ?? 'Unnamed employee',
            ]),
            'state' => Attendance::state($user),
        ]);
    }

    public function state(Request $request): JsonResponse
    {
        return response()->json(['state' => Attendance::state($request->user())]);
    }

    public function clockIn(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['required', 'numeric', 'min:0'],
        ], ['*' => 'Invalid location.']);

        return response()->json(['row' => ApiRow::of(Attendance::clockIn($request->user(), (float) $data['lat'], (float) $data['lng'], (float) $data['accuracy']))]);
    }

    public function clockOut(Request $request): JsonResponse
    {
        return response()->json(['row' => ApiRow::of(Attendance::clockOut($request->user()))]);
    }

    public function review(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'uuid'],
            'status' => ['required', 'string'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], ['id.*' => 'Attendance entry id is required.']);

        return response()->json(['row' => ApiRow::of(Attendance::review($request->user(), $data['id'], $data['status'], $data['notes'] ?? null))]);
    }
}
