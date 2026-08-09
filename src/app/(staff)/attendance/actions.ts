"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { createServerSupabase } from "@/lib/supabase/server";
import { ATTENDANCE_STATUSES, attendanceSchema } from "@/lib/validation/phase6";

type AttendanceRow = {
  id: string;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  status: string;
};

type Phase6ActionResult = { error: string } | { success: true; row: AttendanceRow };
type AttendanceStateResult = { error: string } | { success: true; state: Record<string, unknown> };

const attendanceRowSchema = z
  .object({
    id: z.string().min(1),
    attendance_date: z.string().min(1),
    time_in: z.string().nullable(),
    time_out: z.string().nullable(),
    status: z.enum(ATTENDANCE_STATUSES),
  })
  .passthrough();

const attendanceStateSchema = z
  .object({
    now: z.string().min(1),
    local_date: z.string().min(1),
    attendance: attendanceRowSchema.nullable(),
    schedule: z
      .object({
        id: z.string().min(1),
        employee_id: z.string().min(1),
        workdays: z.array(z.number().int().min(1).max(7)),
        start_time: z.string().min(1),
        end_time: z.string().min(1),
        grace_minutes: z.number().int().min(5).max(10),
        timezone: z.literal("Asia/Manila"),
      })
      .passthrough()
      .nullable(),
    clock_in_allowed: z.boolean(),
    clock_in_blocked_reason: z.string().nullable(),
  })
  .passthrough();

function rpcRow(data: unknown): AttendanceRow | null {
  const candidate = Array.isArray(data) ? data[0] : data;
  const parsed = attendanceRowSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export async function getMyAttendanceState(): Promise<AttendanceStateResult> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("get_my_attendance_state");
  if (error) return { error: error.message };
  const parsed = attendanceStateSchema.safeParse(data);
  if (!parsed.success) return { error: "Attendance state returned an invalid shape." };
  return { success: true, state: parsed.data };
}

export async function clockIn(): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("clock_in_attendance");
  if (error) return { error: error.message };

  const row = rpcRow(data);
  if (!row) return { error: "Clock-in did not return an attendance entry." };

  revalidatePath("/dashboard/attendance");
  return { success: true, row };
}

export async function clockOut(): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("clock_out_attendance");
  if (error) return { error: error.message };

  const row = rpcRow(data);
  if (!row) return { error: "Clock-out did not return an attendance entry." };

  revalidatePath("/dashboard/attendance");
  return { success: true, row };
}

export async function checkAttendance(formData: FormData): Promise<Phase6ActionResult> {
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = attendanceSchema.safeParse({ ...raw, attendance_date: raw.attendance_date as string });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid attendance data." };
  }
  const entryId = z.string().uuid("Attendance entry id is required.").safeParse(raw.id);
  if (!entryId.success) return { error: entryId.error.issues[0]?.message ?? "Attendance entry id is required." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("review_attendance", {
    entry_id: entryId.data,
    status: parsed.data.status,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };

  const row = rpcRow(data);
  if (!row) return { error: "Attendance review did not return an attendance entry." };

  revalidatePath("/dashboard/attendance");
  return { success: true, row };
}
