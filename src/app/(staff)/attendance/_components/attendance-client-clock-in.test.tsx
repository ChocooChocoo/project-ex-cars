import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { clockIn, refresh, toastError } = vi.hoisted(() => ({
  clockIn: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: toastError } }));
vi.mock("@/app/(staff)/attendance/actions", () => ({
  checkAttendance: vi.fn(),
  clockIn,
  clockOut: vi.fn(),
}));

import { AttendanceClient } from "./attendance-client";

type Success = (position: GeolocationPosition) => void;
type Failure = (error: GeolocationPositionError) => void;

let resolvePosition: Success = () => undefined;
let rejectPosition: Failure = () => undefined;

const getCurrentPosition = vi.fn((success: Success, failure: Failure) => {
  resolvePosition = success;
  rejectPosition = failure;
});

function position(lat: number, lng: number, accuracy: number) {
  return { coords: { latitude: lat, longitude: lng, accuracy } } as GeolocationPosition;
}

function renderAttendance() {
  return render(
    <AttendanceClient
      entries={[]}
      canCheck={false}
      todayEntry={null}
      attendanceState={{
        serverNow: "2026-10-31T02:00:00.000Z",
        timeZone: "Asia/Manila",
        timeZoneLabel: "PHT / Asia/Manila",
        currentEntry: null,
        scheduleLabel: "Workdays 1, 2, 3, 4, 5 · 07:00 AM to 04:00 PM",
        graceMinutes: 10,
        reason: null,
        clockIn: { allowed: true, reason: null },
        clockOut: { allowed: false, reason: "Clock in first." },
      }}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  clockIn.mockResolvedValue({ success: true });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
});

describe("AttendanceClient clock-in location", () => {
  it("reads a high-accuracy position and clocks in with its coordinates and accuracy", async () => {
    renderAttendance();
    fireEvent.click(screen.getByRole("button", { name: "Clock In" }));

    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20_000,
    });

    await act(async () => resolvePosition(position(14.3276, 120.9536, 12)));

    await waitFor(() => expect(clockIn).toHaveBeenCalledWith(14.3276, 120.9536, 12));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalled();
  });

  it("explains a denied permission and never calls the clock-in RPC", async () => {
    renderAttendance();
    fireEvent.click(screen.getByRole("button", { name: "Clock In" }));

    await act(async () => rejectPosition({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Location access is blocked. Allow location for this site in your browser settings, then try again.",
      ),
    );
    expect(clockIn).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Clock In" })).toBeEnabled();
  });

  it("shows the refusal returned by the clock-in RPC", async () => {
    clockIn.mockResolvedValue({ error: "You must be at the GCE building to clock in." });
    renderAttendance();
    fireEvent.click(screen.getByRole("button", { name: "Clock In" }));

    await act(async () => resolvePosition(position(14.3364, 120.9536, 5)));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("You must be at the GCE building to clock in."));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("explains when the browser has no geolocation support", async () => {
    Reflect.deleteProperty(navigator, "geolocation");
    renderAttendance();
    fireEvent.click(screen.getByRole("button", { name: "Clock In" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("This browser cannot read your location, so clock-in is unavailable."),
    );
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(clockIn).not.toHaveBeenCalled();
  });
});
