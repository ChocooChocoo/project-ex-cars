"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { logAuditEvent } from "@/lib/auth/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import { performanceReviewSchema } from "@/lib/validation/phase6";

type StaffRecordResult = { error: string } | { success: true };

const REVIEW_MANAGERS = ["ceo", "account_manager"];

export async function submitPerformanceReview(formData: FormData): Promise<StaffRecordResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !REVIEW_MANAGERS.includes(role)) {
    return { error: "Not authorized to submit performance reviews" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = performanceReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid review." };
  }

  const { error } = await supabase.from("performance_reviews").insert({
    employee_id: parsed.data.employee_id,
    reviewer_id: user.user.id,
    review_period_start: parsed.data.review_period_start,
    review_period_end: parsed.data.review_period_end,
    rating: parsed.data.rating ?? null,
    strengths: parsed.data.strengths || null,
    areas_for_improvement: parsed.data.areas_for_improvement || null,
    goals: parsed.data.goals || null,
    status: "submitted",
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/staff-records");
  return { success: true };
}

const ACCOUNT_STATES = ["invited", "active", "suspended", "archived"] as const;

const updateAccountStateSchema = z.object({
  accountId: z.string().uuid(),
  state: z.enum(ACCOUNT_STATES),
});

export async function updateAccountState(formData: FormData): Promise<StaffRecordResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) => ["ceo", "account_manager"].includes(r.role));
  if (!hasRole) return { error: "Not authorized" };

  const parsed = updateAccountStateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid account state." };
  const { accountId, state } = parsed.data;

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_state, activated_at")
    .eq("id", accountId)
    .maybeSingle();
  if (!profile) return { error: "Account not found." };
  if (profile.account_state === state) return { error: `Account is already ${state}.` };

  const update: Record<string, unknown> = { account_state: state };
  if (state === "active" && !profile.activated_at) {
    update.activated_at = new Date().toISOString();
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", accountId);
  if (error) return { error: error.message };

  await logAuditEvent({
    actorId: user.user.id,
    action: `account_state_${state}`,
    recordKind: "profiles",
    recordId: accountId,
    summary: `Account ${accountId} state changed to ${state}`,
  });

  revalidatePath("/dashboard/staff-records");
  revalidatePath("/dashboard/users");
  return { success: true };
}

const updateProfileDetailsSchema = z.object({
  accountId: z.string().uuid(),
  fullName: z.string().min(1, "Full name is required.").max(200),
  phone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
});

export async function updateProfileDetails(formData: FormData): Promise<StaffRecordResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) => ["ceo", "account_manager"].includes(r.role));
  if (!hasRole) return { error: "Not authorized" };

  const parsed = updateProfileDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid profile details." };
  const { accountId, fullName, phone, address } = parsed.data;

  const { error } = await supabase.from("profiles").update({ full_name: fullName, phone, address }).eq("id", accountId);
  if (error) return { error: error.message };

  await logAuditEvent({
    actorId: user.user.id,
    action: "profile_updated",
    recordKind: "profiles",
    recordId: accountId,
    summary: `Profile details updated for account ${accountId}`,
  });

  revalidatePath("/dashboard/staff-records");
  return { success: true };
}
