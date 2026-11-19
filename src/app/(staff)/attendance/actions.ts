"use client";

import { z } from "zod";

import { type ActionResult, apiAction } from "@/lib/api/action";
import { browserApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { attendanceSchema } from "@/lib/validation/phase6";

// Phase 7: browser adapters for the Laravel attendance endpoints (were Server Actions over the Postgres
// get_my_attendance_state / clock_in_attendance / clock_out_attendance / review_attendance functions).

type AttendanceRow = {
  id: string;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  status: string;
};

type Phase6ActionResult = ActionResult<{ row: AttendanceRow }>;
type AttendanceStateResult = { error: string } | { success: true; state: Record<string, unknown> };

export async function getMyAttendanceState(): Promise<AttendanceStateResult> {
  try {
    const { state } = await browserApi<{ state: Record<string, unknown> }>("GET", "/api/v1/staff/attendance/state");
    return { success: true, state };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

const clockInLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative(),
});

export async function clockIn(lat: number, lng: number, accuracy: number): Promise<Phase6ActionResult> {
  const parsed = clockInLocationSchema.safeParse({ lat, lng, accuracy });
  if (!parsed.success) return { error: "Invalid location." };
  return apiAction("/staff/attendance/clock-in", parsed.data);
}

export async function clockOut(): Promise<Phase6ActionResult> {
  return apiAction("/staff/attendance/clock-out");
}

export async function checkAttendance(formData: FormData): Promise<Phase6ActionResult> {
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = attendanceSchema.safeParse({ ...raw, attendance_date: raw.attendance_date as string });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid attendance data." };
  const entryId = z.string().uuid("Attendance entry id is required.").safeParse(raw.id);
  if (!entryId.success) return { error: entryId.error.issues[0]?.message ?? "Attendance entry id is required." };
  return apiAction("/staff/attendance/review", {
    id: entryId.data,
    status: parsed.data.status,
    notes: parsed.data.notes || null,
  });
}
