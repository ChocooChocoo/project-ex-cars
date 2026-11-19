"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import { ATTENDANCE_TRACKED_ROLES } from "@/lib/auth/roles";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/validation/phase6";

import { AttendanceClient, type AttendanceEntry, type AttendanceState } from "./_components/attendance-client";

const ATTENDANCE_CHECKERS = ["account_manager"];
// Task 32: checking is Account-Manager-only, but CEO + Head Accountant keep
// read/summary oversight (CEO staffing oversight, HA payroll cross-check).
const ATTENDANCE_READERS = ["account_manager", "ceo", "head_accountant"];
const TIME_ZONE = "Asia/Manila";
const ATTENDANCE_LIVE_STATE_UNAVAILABLE_REASON = "Live attendance state is unavailable. Please refresh and try again.";

interface WorkScheduleRow {
  employee_id: string;
  workdays: number[];
  start_time: string;
  end_time: string;
  grace_minutes: number;
  timezone: "Asia/Manila";
}

interface AttendanceRpcEntry {
  id: string;
  employee_id: string;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  status: AttendanceStatus;
  notes: string | null;
  checked_by: string | null;
}

export interface AttendanceRpcState {
  now: string;
  local_date: string;
  attendance: AttendanceRpcEntry | null;
  schedule: {
    workdays: number[];
    start_time: string;
    end_time: string;
    grace_minutes: number;
    timezone: "Asia/Manila";
  } | null;
  clock_in_allowed: boolean;
  clock_in_blocked_reason: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isValidRpcTimestamp(value: string) {
  return isValidRpcLocalDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

function isValidRpcLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && ATTENDANCE_STATUSES.some((status) => status === value);
}

function parseAttendanceRpcState(value: Record<string, unknown>): AttendanceRpcState | null {
  if (
    typeof value.now !== "string" ||
    !isValidRpcTimestamp(value.now) ||
    typeof value.local_date !== "string" ||
    !isValidRpcLocalDate(value.local_date) ||
    typeof value.clock_in_allowed !== "boolean" ||
    !isNullableString(value.clock_in_blocked_reason)
  ) {
    return null;
  }

  let attendance: AttendanceRpcEntry | null = null;
  if (value.attendance !== null) {
    if (!isRecord(value.attendance)) return null;
    const row = value.attendance;
    if (
      typeof row.id !== "string" ||
      typeof row.employee_id !== "string" ||
      typeof row.attendance_date !== "string" ||
      !isNullableString(row.time_in) ||
      !isNullableString(row.time_out) ||
      !(row.hours_worked === null || typeof row.hours_worked === "number") ||
      !isAttendanceStatus(row.status) ||
      !isNullableString(row.notes) ||
      !isNullableString(row.checked_by)
    ) {
      return null;
    }
    attendance = {
      id: row.id,
      employee_id: row.employee_id,
      attendance_date: row.attendance_date,
      time_in: row.time_in,
      time_out: row.time_out,
      hours_worked: row.hours_worked,
      status: row.status,
      notes: row.notes,
      checked_by: row.checked_by,
    };
  }

  let schedule: AttendanceRpcState["schedule"] = null;
  if (value.schedule !== null) {
    if (!isRecord(value.schedule)) return null;
    const row = value.schedule;
    if (
      !isNumberArray(row.workdays) ||
      typeof row.start_time !== "string" ||
      typeof row.end_time !== "string" ||
      typeof row.grace_minutes !== "number" ||
      row.timezone !== "Asia/Manila"
    ) {
      return null;
    }
    schedule = {
      workdays: row.workdays,
      start_time: row.start_time,
      end_time: row.end_time,
      grace_minutes: row.grace_minutes,
      timezone: row.timezone,
    };
  }

  return {
    now: value.now,
    local_date: value.local_date,
    attendance,
    schedule,
    clock_in_allowed: value.clock_in_allowed,
    clock_in_blocked_reason: value.clock_in_blocked_reason,
  };
}

export function mapAttendanceRpcState(
  state: AttendanceRpcState,
  currentEntry: AttendanceEntry | null,
): AttendanceState {
  if (!isValidRpcTimestamp(state.now) || !isValidRpcLocalDate(state.local_date)) {
    return buildUnavailableAttendanceState(new Date(), currentEntry);
  }
  const attendance = state.attendance
    ? {
        ...state.attendance,
        employee_name:
          currentEntry?.employee_id === state.attendance.employee_id ? currentEntry.employee_name : "Current employee",
      }
    : null;
  const schedule = state.schedule;
  const blockedReason = state.clock_in_blocked_reason;
  const hasOpenAttendance = Boolean(attendance?.time_in && !attendance.time_out);
  const clockOutAllowed = hasOpenAttendance && !attendance?.checked_by;
  return {
    serverNow: state.now,
    timeZone: "Asia/Manila",
    timeZoneLabel: "PHT / Asia/Manila",
    currentEntry: attendance,
    scheduleLabel: schedule ? scheduleLabel(schedule) : null,
    graceMinutes: schedule ? schedule.grace_minutes : null,
    reason: blockedReason,
    clockIn: { allowed: state.clock_in_allowed, reason: blockedReason },
    clockOut: {
      allowed: clockOutAllowed,
      reason: clockOutAllowed
        ? null
        : attendance?.checked_by
          ? "Attendance has already been checked."
          : "Clock in first.",
    },
  };
}

function formatScheduleTime(value: string) {
  const [hours = "00", minutes = "00"] = value.split(":");
  const hour = Number(hours);
  return `${String(hour === 0 || hour === 12 ? 12 : hour % 12).padStart(2, "0")}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}

type ScheduleDetails = Pick<WorkScheduleRow, "workdays" | "start_time" | "end_time" | "grace_minutes">;

function scheduleLabel(schedule: ScheduleDetails) {
  const days = schedule.workdays.join(", ");
  return `Workdays ${days} · ${formatScheduleTime(schedule.start_time)} to ${formatScheduleTime(schedule.end_time)}`;
}

function buildUnavailableAttendanceState(
  now: Date,
  currentEntry: AttendanceEntry | null,
  schedule: WorkScheduleRow | null = null,
  reason = ATTENDANCE_LIVE_STATE_UNAVAILABLE_REASON,
): AttendanceState {
  return {
    serverNow: now.toISOString(),
    timeZone: TIME_ZONE,
    timeZoneLabel: "PHT / Asia/Manila",
    currentEntry,
    scheduleLabel: schedule ? scheduleLabel(schedule) : null,
    graceMinutes: schedule ? schedule.grace_minutes : null,
    isDataUnavailable: true,
    reason,
    clockIn: { allowed: false, reason },
    clockOut: { allowed: false, reason },
  };
}

export default function AttendancePage() {
  const allowed = useRequireRole(ATTENDANCE_TRACKED_ROLES);
  // Phase 7: Laravel returns own history (or the latest 100 for CEO/AM/HA) and the clock state.
  const page = usePageData(allowed ? "attendance" : "attendance:denied", () =>
    allowed
      ? browserApi<{ role: string; currentUserId: string; entries: AttendanceEntry[]; state: Record<string, unknown> }>(
          "GET",
          "/api/v1/staff/attendance",
        )
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const { role, currentUserId, entries, state } = page.data;

  const isAccountManager = ATTENDANCE_CHECKERS.includes(role);
  const canReadAll = ATTENDANCE_READERS.includes(role);
  const rpcState = parseAttendanceRpcState(state);
  const today = rpcState?.local_date;
  const todayEntry =
    entries.find((entry) => entry.employee_id === currentUserId && entry.attendance_date === today) ?? null;
  const attendanceState = rpcState
    ? mapAttendanceRpcState(rpcState, todayEntry)
    : buildUnavailableAttendanceState(new Date(), todayEntry);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Attendance</h1>
        <p className="text-muted-foreground text-sm">
          {isAccountManager
            ? "Managed by the Account Manager. Clock in, clock out, and review employee attendance records."
            : canReadAll
              ? "Attendance records for oversight. Checking is managed by the Account Manager."
              : "Your attendance history."}
        </p>
      </div>

      <AttendanceClient
        entries={entries}
        canCheck={isAccountManager}
        canReadAll={canReadAll}
        todayEntry={todayEntry}
        attendanceState={attendanceState}
        realtimeEnabled
      />
    </div>
  );
}
