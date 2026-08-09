import { describe, expect, it } from "vitest";

import {
  ATTENDANCE_ENTRY_SELECT,
  type AttendanceRpcState,
  buildAttendanceRealtimeAccess,
  getAttendanceDataError,
  mapAttendanceRpcState,
} from "./page";

describe("attendance page data loading", () => {
  it("qualifies the employee profile relationship in attendance queries", () => {
    expect(ATTENDANCE_ENTRY_SELECT).toContain("profiles!attendance_entries_employee_id_fkey(full_name)");
  });

  it("surfaces a failed attendance dependency instead of treating it as missing data", () => {
    const reason = getAttendanceDataError([
      { error: null },
      { error: { message: "schedule permission denied" } },
      { error: null },
      { error: null },
    ]);

    expect(reason).toBe("Attendance supporting data is temporarily unavailable. Please refresh and try again.");
  });

  it("returns no unavailable reason when every attendance dependency succeeds", () => {
    expect(getAttendanceDataError([{ error: null }, { error: null }, { error: null }, { error: null }])).toBeNull();
  });

  it("gives Head Accountant all authorized attendance, leave, and schedule realtime scopes", () => {
    expect(buildAttendanceRealtimeAccess("head_accountant", "employee-1")).toEqual({
      attendanceEmployeeId: null,
      leaveEmployeeId: null,
      scheduleEmployeeId: null,
    });
  });

  it("maps the database-time RPC state into authoritative UI availability", () => {
    const state: AttendanceRpcState = {
      now: "2026-08-09T00:00:00.000Z",
      local_date: "2026-08-09",
      attendance: null,
      schedule: {
        workdays: [1, 2, 3, 4, 5],
        start_time: "08:00:00",
        end_time: "17:00:00",
        grace_minutes: 10,
        timezone: "Asia/Manila",
      },
      clock_in_allowed: false,
      clock_in_blocked_reason: "Approved leave applies today.",
    };

    const mapped = mapAttendanceRpcState(state, null);

    expect(mapped.serverNow).toBe(state.now);
    expect(mapped.scheduleLabel).toContain("08:00 AM");
    expect(mapped.clockIn).toEqual({ allowed: false, reason: "Approved leave applies today." });
    expect(mapped.reason).toBe("Approved leave applies today.");
  });

  it("keeps clock-out disabled when an open row is already checked", () => {
    const state: AttendanceRpcState = {
      now: "2026-08-09T00:00:00.000Z",
      local_date: "2026-08-09",
      attendance: {
        id: "11111111-1111-4111-8111-111111111111",
        employee_id: "22222222-2222-4222-8222-222222222222",
        attendance_date: "2026-08-09",
        time_in: "2026-08-09T00:00:00.000Z",
        time_out: null,
        hours_worked: null,
        status: "present",
        notes: null,
        checked_by: "33333333-3333-4333-8333-333333333333",
      },
      schedule: null,
      clock_in_allowed: false,
      clock_in_blocked_reason: "Attendance has already been checked.",
    };

    const mapped = mapAttendanceRpcState(state, null);

    expect(mapped.clockOut).toEqual({ allowed: false, reason: "Attendance has already been checked." });
  });

  it.each([
    ["now", { now: "not-a-timestamp" }],
    ["now", { now: "2026-02-30T12:00:00.000Z" }],
    ["local_date", { local_date: "not-a-date" }],
  ] as const)("falls back to unavailable state when RPC %s is malformed", (_field, override) => {
    const state: AttendanceRpcState = {
      now: "2026-08-09T00:00:00.000Z",
      local_date: "2026-08-09",
      attendance: null,
      schedule: null,
      clock_in_allowed: true,
      clock_in_blocked_reason: null,
      ...override,
    };

    const mapped = mapAttendanceRpcState(state, null);

    expect(mapped.clockIn.allowed).toBe(false);
    expect(mapped.reason).toBe("Live attendance state is unavailable. Please refresh and try again.");
    expect(() =>
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila" }).format(new Date(mapped.serverNow)),
    ).not.toThrow();
  });
});
