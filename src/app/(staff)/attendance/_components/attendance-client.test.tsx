import type { ComponentProps } from "react";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AttendanceClient, type AttendanceEntry, type AttendanceState } from "./attendance-client";

const refresh = vi.fn();
const removeChannel = vi.fn();
const subscribe = vi.fn();
const on = vi.fn();
const channel = { on, subscribe };

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(staff)/attendance/actions", () => ({
  checkAttendance: vi.fn(),
  clockIn: vi.fn(),
  clockOut: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ channel: vi.fn(() => channel), removeChannel }),
}));

const now = "2026-08-09T00:00:00.000Z";

function entry(overrides: Partial<AttendanceEntry> = {}): AttendanceEntry {
  return {
    id: "entry-1",
    employee_id: "employee-1",
    employee_name: "Ada Santos",
    attendance_date: "2026-08-09",
    time_in: null,
    time_out: null,
    hours_worked: null,
    status: "present",
    notes: null,
    checked_by: null,
    ...overrides,
  };
}

function renderAttendance(options: Partial<ComponentProps<typeof AttendanceClient>> = {}) {
  return render(
    <AttendanceClient
      entries={[entry()]}
      canCheck
      todayEntry={null}
      attendanceState={{
        serverNow: now,
        timeZone: "Asia/Manila",
        timeZoneLabel: "PHT / Asia/Manila",
        currentEntry: null,
        scheduleLabel: "Monday to Friday, 08:00 AM to 05:00 PM",
        graceMinutes: 10,
        reason: null,
        clockIn: { allowed: true, reason: null },
        clockOut: { allowed: false, reason: "Clock in first." },
      }}
      realtimeEnabled
      {...options}
    />,
  );
}

describe("AttendanceClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    refresh.mockReset();
    removeChannel.mockReset();
    subscribe.mockReset();
    on.mockReset();
    on.mockReturnValue(channel);
    subscribe.mockReturnValue(channel);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks its server-anchored PHT clock once per second and clears the timer on unmount", () => {
    const { unmount } = renderAttendance();
    const clock = screen.getByTestId("attendance-clock");
    const firstValue = clock.textContent;

    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByText("PHT / Asia/Manila")).toBeInTheDocument();
    expect(clock.textContent).not.toBe(firstValue);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails closed with a refresh action when attendance data is unavailable", () => {
    renderAttendance({
      attendanceState: {
        serverNow: now,
        timeZone: "Asia/Manila",
        timeZoneLabel: "PHT / Asia-Manila",
        currentEntry: null,
        scheduleLabel: null,
        graceMinutes: null,
        reason: "Live attendance state is unavailable. Please refresh and try again.",
        isDataUnavailable: true,
        clockIn: { allowed: false, reason: "Live attendance state is unavailable." },
        clockOut: { allowed: false, reason: "Live attendance state is unavailable." },
      } as AttendanceState,
    });

    const refreshButton = screen.getByRole("button", { name: "Refresh attendance" });
    expect(refreshButton).toBeInTheDocument();
    fireEvent.click(refreshButton);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Clock In" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clock Out" })).toBeDisabled();
  });

  it("emphasizes the centered PHT clock with responsive display sizing", () => {
    renderAttendance();

    expect(screen.getByTestId("attendance-clock")).toHaveClass("text-4xl", "sm:text-5xl", "md:text-6xl");
  });

  it("formats attendance times in Asia/Manila instead of the browser timezone", () => {
    renderAttendance({ entries: [entry({ time_in: "2026-08-09T00:00:00.000Z" })] });

    expect(screen.getByText("08:00 AM")).toBeInTheDocument();
  });

  it("uses the shared DataTable and paginates attendance records with its dedicated rows-per-page id", () => {
    renderAttendance({
      entries: Array.from({ length: 11 }, (_, index) =>
        entry({ id: `entry-${index + 1}`, employee_name: `Employee ${index + 1}` }),
      ),
    });

    expect(document.getElementById("attendance-rows-per-page")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Employee 11")).toBeInTheDocument();
  });

  it.each([
    ["present", "Present", "bg-emerald-500"],
    ["late", "Late", "bg-amber-500"],
    ["absent", "Absent", "bg-destructive"],
    ["on_leave", "Leave", "border"],
    ["half_day", "Half Day", "bg-sky-500"],
  ] as const)("renders %s with its semantic badge treatment", (status, label, expectedClass) => {
    renderAttendance({ entries: [entry({ status })] });

    expect(screen.getByText(label)).toHaveClass(expectedClass);
  });

  it("shows employee names to authorized attendance checkers and keeps review targeting on the selected row", () => {
    renderAttendance();

    expect(screen.getByRole("columnheader", { name: "Employee" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Ada Santos")).toBeInTheDocument();
  });

  it("disables clock-in while approved leave is authoritative", () => {
    renderAttendance({
      attendanceState: {
        serverNow: now,
        timeZone: "Asia/Manila",
        timeZoneLabel: "PHT / Asia/Manila",
        currentEntry: null,
        scheduleLabel: "Monday to Friday, 08:00 AM to 05:00 PM",
        graceMinutes: 10,
        reason: "Approved leave today.",
        clockIn: { allowed: false, reason: "Approved leave today." },
        clockOut: { allowed: false, reason: "Clock in first." },
      },
    });

    expect(screen.getByRole("button", { name: "Clock In" })).toBeDisabled();
    expect(screen.getByText("Approved leave today.")).toBeInTheDocument();
  });

  it("refreshes only authorized realtime changes and removes every channel on unmount", () => {
    const { unmount } = renderAttendance();
    const callbacks = on.mock.calls.map((call) => call[2] as () => void);

    expect(on).toHaveBeenCalledTimes(3);
    act(() => callbacks[0]?.());
    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});
