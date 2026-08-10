"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { performanceReviewSchema } from "@/lib/validation/phase6";

type StaffRecordResult = { error: string } | { success: true };

const REVIEW_MANAGERS = ["ceo", "account_manager"];

export async function submitPerformanceReview(formData: FormData): Promise<StaffRecordResult> {
  const supabase = await createServerSupabaseClient();
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

const performanceReviewUpdateSchema = performanceReviewSchema.extend({
  review_id: z.string().uuid(),
});

export async function updatePerformanceReview(formData: FormData): Promise<StaffRecordResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !REVIEW_MANAGERS.includes(role)) {
    return { error: "Not authorized to update performance reviews" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = performanceReviewUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid review." };
  }

  const { error } = await supabase
    .from("performance_reviews")
    .update({
      employee_id: parsed.data.employee_id,
      review_period_start: parsed.data.review_period_start,
      review_period_end: parsed.data.review_period_end,
      rating: parsed.data.rating ?? null,
      strengths: parsed.data.strengths || null,
      areas_for_improvement: parsed.data.areas_for_improvement || null,
      goals: parsed.data.goals || null,
    })
    .eq("id", parsed.data.review_id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/staff-records");
  return { success: true };
}

const ACCOUNT_STATES = ["invited", "active", "suspended", "archived"] as const;

type StaffRecordRow = {
  id: string;
  account_state: (typeof ACCOUNT_STATES)[number];
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
};

type StaffRecordRpcResult =
  | { error: string }
  | { success: true; row: StaffRecordRow; schedule?: Record<string, unknown> | null };

const staffRecordProfileResponseSchema = z
  .object({
    id: z.string().uuid(),
    account_state: z.enum(ACCOUNT_STATES),
    full_name: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
  })
  .passthrough();

const staffScheduleResponseSchema = z
  .object({
    id: z.string().uuid(),
    employee_id: z.string().uuid(),
    workdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
    grace_minutes: z.number().int().min(5).max(10),
    timezone: z.literal("Asia/Manila"),
  })
  .passthrough();

const saveStaffRecordResponseSchema = z.object({
  profile: staffRecordProfileResponseSchema,
  schedule: staffScheduleResponseSchema.nullable(),
});

const saveStaffRecordSchema = z.object({
  accountId: z.string().uuid(),
  fullName: z.string().min(1, "Full name is required.").max(200),
  phone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
});

const staffScheduleSchema = z.object({
  workdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Start time is required."),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "End time is required."),
  graceMinutes: z.number().int().min(5).max(10),
});

function parseWorkdays(value: FormDataEntryValue | null): number[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((day) => Number(day.trim()))
    .filter((day) => Number.isInteger(day));
}

export async function saveStaffRecord(formData: FormData): Promise<StaffRecordRpcResult> {
  const raw = Object.fromEntries(formData);
  const parsed = saveStaffRecordSchema.safeParse({
    accountId: raw.accountId,
    fullName: raw.fullName,
    phone: raw.phone,
    address: raw.address,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid staff record." };

  const hasSchedule = ["workdays", "startTime", "endTime", "graceMinutes"].some((field) => formData.has(field));
  const schedule = hasSchedule
    ? staffScheduleSchema.safeParse({
        workdays: parseWorkdays(formData.get("workdays")),
        startTime: raw.startTime,
        endTime: raw.endTime,
        graceMinutes: Number(raw.graceMinutes),
      })
    : null;
  if (schedule && !schedule.success) return { error: schedule.error.issues[0]?.message ?? "Invalid work schedule." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("save_staff_record", {
    account_id: parsed.data.accountId,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    workdays: schedule?.data.workdays ?? null,
    start_time: schedule?.data.startTime ?? null,
    end_time: schedule?.data.endTime ?? null,
    grace_minutes: schedule?.data.graceMinutes ?? null,
  });
  if (error) return { error: error.message };

  const response = saveStaffRecordResponseSchema.safeParse(data);
  if (!response.success) return { error: "Staff record returned invalid shape." };
  if (schedule?.data && response.data.schedule?.employee_id !== parsed.data.accountId) {
    return { error: "Staff record returned invalid shape." };
  }

  revalidatePath("/dashboard/staff-records");
  return { success: true, row: response.data.profile, schedule: response.data.schedule };
}

export async function setAccountState(formData: FormData): Promise<StaffRecordRpcResult> {
  const parsed = updateAccountStateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid account state." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_account_state", {
    account_id: parsed.data.accountId,
    state: parsed.data.state,
  });
  if (error) return { error: error.message };

  const response = staffRecordProfileResponseSchema.safeParse(data);
  if (!response.success) return { error: "Account state returned invalid shape." };

  revalidatePath("/dashboard/staff-records");
  revalidatePath("/dashboard/users");
  return { success: true, row: response.data, schedule: null };
}

const updateAccountStateSchema = z.object({
  accountId: z.string().uuid(),
  state: z.enum(ACCOUNT_STATES),
});

export async function updateAccountState(formData: FormData): Promise<StaffRecordResult> {
  const result = await setAccountState(formData);
  return "error" in result ? result : { success: true };
}

const updateProfileDetailsSchema = z.object({
  accountId: z.string().uuid(),
  fullName: z.string().min(1, "Full name is required.").max(200),
  phone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
});

export async function updateProfileDetails(formData: FormData): Promise<StaffRecordResult> {
  const parsed = updateProfileDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid profile details." };
  const result = await saveStaffRecord(formData);
  return "error" in result ? result : { success: true };
}
