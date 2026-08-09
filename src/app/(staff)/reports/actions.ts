"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validation/phase6";

type Phase6ActionResult = { error: string } | { success: true };

const REPORT_CREATORS = ["ceo", "head_accountant", "account_manager"];
const REPORT_REVIEWERS = ["ceo", "head_accountant"];

export async function submitReport(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !REPORT_CREATORS.includes(role)) {
    return { error: "Not authorized to submit reports" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid report." };
  }

  const { error } = await supabase.from("reports").insert({
    report_kind: parsed.data.report_kind,
    title: parsed.data.title,
    description: parsed.data.description || null,
    submitted_by: user.user.id,
    status: "submitted",
    period_start: parsed.data.period_start || null,
    period_end: parsed.data.period_end || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/reports");
  return { success: true };
}

export async function reviewReport(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !REPORT_REVIEWERS.includes(role)) {
    return { error: "Not authorized to review reports" };
  }

  const reportId = formData.get("report_id") as string;
  const { error } = await supabase
    .from("reports")
    .update({ status: "reviewed", updated_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/reports");
  return { success: true };
}
