"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { attendanceSchema } from "@/lib/validation/phase6";

type Phase6ActionResult = { error: string } | { success: true };

const ATTENDANCE_CHECKERS = ["ceo", "account_manager", "head_accountant"];

export async function clockIn(): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("attendance_entries")
    .select("id, time_in")
    .eq("employee_id", user.user.id)
    .eq("attendance_date", today)
    .single();

  if (existing?.time_in) return { error: "You have already clocked in today." };

  if (existing) {
    const { error } = await supabase
      .from("attendance_entries")
      .update({ time_in: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("attendance_entries").insert({
      employee_id: user.user.id,
      attendance_date: today,
      time_in: new Date().toISOString(),
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/attendance");
  return { success: true };
}

export async function clockOut(): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("attendance_entries")
    .select("id, time_out")
    .eq("employee_id", user.user.id)
    .eq("attendance_date", today)
    .single();

  if (!existing) return { error: "You have not clocked in today." };
  if (existing.time_out) return { error: "You have already clocked out today." };

  const { error } = await supabase
    .from("attendance_entries")
    .update({ time_out: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/attendance");
  return { success: true };
}

export async function checkAttendance(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !ATTENDANCE_CHECKERS.includes(role)) {
    return { error: "Not authorized to check attendance" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = attendanceSchema.safeParse({ ...raw, attendance_date: raw.attendance_date as string });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid attendance data." };
  }

  const { error } = await supabase
    .from("attendance_entries")
    .update({
      status: parsed.data.status,
      notes: parsed.data.notes || null,
      checked_by: user.user.id,
      checked_at: new Date().toISOString(),
    })
    .eq("id", raw.id as string);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/attendance");
  return { success: true };
}
