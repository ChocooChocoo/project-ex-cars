"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { employeeRequestSchema, requestReviewSchema } from "@/lib/validation/phase6";

type Phase6ActionResult = { error: string } | { success: true };

const REQUEST_REVIEWERS = ["ceo", "account_manager"];

export async function submitEmployeeRequest(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = employeeRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const { error } = await supabase.from("employee_requests").insert({
    employee_id: user.user.id,
    request_kind: parsed.data.request_kind,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date || null,
    reason: parsed.data.reason,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/employee-requests");
  return { success: true };
}

export async function cancelEmployeeRequest(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const requestId = formData.get("request_id") as string;
  const { error } = await supabase
    .from("employee_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("employee_id", user.user.id)
    .eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/dashboard/employee-requests");
  return { success: true };
}

export async function reviewEmployeeRequest(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !REQUEST_REVIEWERS.includes(role)) {
    return { error: "Not authorized to review requests" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = requestReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid review." };
  }

  const { error } = await supabase
    .from("employee_requests")
    .update({
      status: parsed.data.decision,
      reviewed_by: user.user.id,
      review_notes: parsed.data.review_notes || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.request_id)
    .eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/dashboard/employee-requests");
  return { success: true };
}
