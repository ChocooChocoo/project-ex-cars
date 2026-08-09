import { redirect } from "next/navigation";

import { getMyAttendanceState } from "@/app/(staff)/attendance/actions";
import { getCurrentRole } from "@/app/auth/actions";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/validation/phase6";

import {
  AttendanceClient,
  type AttendanceEntry,
  type AttendanceRealtimeAccess,
  type AttendanceState,
} from "./_components/attendance-client";

const ATTENDANCE_CHECKERS = ["ceo", "account_manager", "head_accountant"];
const TIME_ZONE = "Asia/Manila";
export const ATTENDANCE_ENTRY_SELECT =
  "id, employee_id, attendance_date, time_in, time_out, hours_worked, status, notes, checked_by, profiles!attendance_entries_employee_id_fkey(full_name)";
const ATTENDANCE_SUPPORTING_DATA_UNAVAILABLE_REASON =
  "Attendance supporting data is temporarily unavailable. Please refresh and try again.";
const ATTENDANCE_LIVE_STATE_UNAVAILABLE_REASON = "Live attendance state is unavailable. Please refresh and try again.";

interface AttendanceQueryError {
  error: { message: string } | null;
}

export function getAttendanceDataError(results: ReadonlyArray<AttendanceQueryError>) {
  return results.some((result) => result.error !== null) ? ATTENDANCE_SUPPORTING_DATA_UNAVAILABLE_REASON : null;
}

export function buildAttendanceRealtimeAccess(role: string, employeeId: string): AttendanceRealtimeAccess {
  const canReadAll = ATTENDANCE_CHECKERS.includes(role);
  return {
    attendanceEmployeeId: canReadAll ? null : employeeId,
    leaveEmployeeId: canReadAll ? null : employeeId,
    scheduleEmployeeId: canReadAll ? null : employeeId,
  };
}

interface AttendanceEntryRow {
  id: string;
  employee_id: string;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  status: AttendanceStatus;
  notes: string | null;
  checked_by: string | null;
  profiles: { full_name: string | null } | null;
}

interface WorkScheduleRow {
  employee_id: string;
  workdays: number[];
  start_time: string;
  end_time: string;
  grace_minutes: number;
  timezone: "Asia/Manila";
}

interface ApprovedLeaveRow {
  employee_id: string;
  request_kind: string;
  status: string;
  start_date: string;
  end_date: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  account_state: string;
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

function philippinesDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
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

function philippinesIsoWeekday(now: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(now);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 1;
}

function toAttendanceEntry(row: AttendanceEntryRow): AttendanceEntry {
  return {
    id: row.id,
    employee_id: row.employee_id,
    employee_name: row.profiles?.full_name ?? "Unnamed employee",
    attendance_date: row.attendance_date,
    time_in: row.time_in,
    time_out: row.time_out,
    hours_worked: row.hours_worked,
    status: row.status,
    notes: row.notes,
    checked_by: row.checked_by,
  };
}

function _buildAttendanceState({
  now,
  currentEntry,
  profile,
  schedule,
  onApprovedLeave,
}: {
  now: Date;
  currentEntry: AttendanceEntry | null;
  profile: ProfileRow | null;
  schedule: WorkScheduleRow | null;
  onApprovedLeave: boolean;
}): AttendanceState {
  const unavailable = (reason: string): AttendanceState => ({
    serverNow: now.toISOString(),
    timeZone: TIME_ZONE,
    timeZoneLabel: "PHT / Asia/Manila",
    currentEntry,
    scheduleLabel: schedule ? scheduleLabel(schedule) : null,
    graceMinutes: schedule ? schedule.grace_minutes : null,
    reason,
    clockIn: { allowed: false, reason },
    clockOut: {
      allowed: Boolean(currentEntry?.time_in && !currentEntry.time_out),
      reason: currentEntry?.time_in && !currentEntry.time_out ? null : "Clock in first.",
    },
  });

  if (profile?.account_state !== "active") return unavailable("Your account is not active for attendance.");
  if (!schedule) return unavailable("No work schedule is assigned today.");
  if (!schedule.workdays.includes(philippinesIsoWeekday(now))) return unavailable("Today is an assigned off day.");
  if (onApprovedLeave) return unavailable("Approved leave applies today.");

  const canClockIn = !currentEntry?.time_in;
  const canClockOut = Boolean(currentEntry?.time_in && !currentEntry.time_out);
  return {
    serverNow: now.toISOString(),
    timeZone: TIME_ZONE,
    timeZoneLabel: "PHT / Asia/Manila",
    currentEntry,
    scheduleLabel: scheduleLabel(schedule),
    graceMinutes: schedule.grace_minutes,
    reason: null,
    clockIn: { allowed: canClockIn, reason: canClockIn ? null : "You have already clocked in today." },
    clockOut: { allowed: canClockOut, reason: canClockOut ? null : "Clock in first." },
  };
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

export default async function AttendancePage() {
  await requireRole(STAFF_ROLES);
  const role = await getCurrentRole();
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const isStaff = ATTENDANCE_CHECKERS.includes(role);
  const attendanceQuery = supabase
    .from("attendance_entries")
    .select(ATTENDANCE_ENTRY_SELECT)
    .order("attendance_date", { ascending: false })
    .limit(isStaff ? 100 : 30);
  if (!isStaff) attendanceQuery.eq("employee_id", user.id);

  const now = new Date();
  const today = philippinesDate(now);
  const [rpcResult, attendanceResult, scheduleResult, leaveResult, profileResult] = await Promise.all([
    getMyAttendanceState(),
    attendanceQuery.returns<AttendanceEntryRow[]>(),
    supabase
      .from("employee_work_schedules")
      .select("employee_id, workdays, start_time, end_time, grace_minutes, timezone")
      .eq("employee_id", user.id)
      .returns<WorkScheduleRow[]>(),
    supabase
      .from("employee_requests")
      .select("employee_id, request_kind, status, start_date, end_date")
      .eq("employee_id", user.id)
      .eq("request_kind", "leave")
      .eq("status", "approved")
      .returns<ApprovedLeaveRow[]>(),
    supabase.from("profiles").select("id, full_name, account_state").eq("id", user.id).maybeSingle<ProfileRow>(),
  ]);

  const entries = (attendanceResult.data ?? []).map(toAttendanceEntry);
  const todayEntry = entries.find((entry) => entry.employee_id === user.id && entry.attendance_date === today) ?? null;
  const realtimeAccess = buildAttendanceRealtimeAccess(role, user.id);
  const dataError = getAttendanceDataError([attendanceResult, scheduleResult, leaveResult, profileResult]);
  const unavailableState = (reason?: string) =>
    buildUnavailableAttendanceState(now, todayEntry, scheduleResult.data?.[0] ?? null, reason);
  const attendanceState = dataError
    ? unavailableState(dataError)
    : "error" in rpcResult
      ? unavailableState()
      : (() => {
          const rpcState = parseAttendanceRpcState(rpcResult.state);
          return rpcState ? mapAttendanceRpcState(rpcState, todayEntry) : unavailableState();
        })();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Attendance</h1>
        <p className="text-muted-foreground text-sm">
          {isStaff ? "Clock in, clock out, and review employee attendance records." : "Your attendance history."}
        </p>
      </div>

      <AttendanceClient
        entries={entries}
        canCheck={isStaff}
        todayEntry={todayEntry}
        attendanceState={attendanceState}
        realtimeEnabled
        realtimeAccess={realtimeAccess}
      />
    </div>
  );
}
