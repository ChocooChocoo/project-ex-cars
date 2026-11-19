"use client";

import { z } from "zod";

import { apiAction } from "@/lib/api/action";
import { performanceReviewSchema } from "@/lib/validation/phase6";

// Phase 7: browser adapters for the Laravel staff-record endpoints (StaffRecordController). Laravel checks the
// role (CEO/AM; Super Admin may change account state) and derives the reviewer from the session.

type StaffRecordResult = { error: string } | { success: true };

function reviewBody(data: z.infer<typeof performanceReviewSchema>) {
  return {
    employee_id: data.employee_id,
    review_period_start: data.review_period_start,
    review_period_end: data.review_period_end,
    rating: data.rating ?? null,
    strengths: data.strengths || null,
    areas_for_improvement: data.areas_for_improvement || null,
    goals: data.goals || null,
  };
}

async function done(path: string, body: unknown): Promise<StaffRecordResult> {
  const result = await apiAction(path, body);
  return result.error !== undefined ? { error: result.error } : { success: true };
}

export async function submitPerformanceReview(formData: FormData): Promise<StaffRecordResult> {
  const parsed = performanceReviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid review." };
  return done("/staff/staff-records/performance-reviews", reviewBody(parsed.data));
}

const performanceReviewUpdateSchema = performanceReviewSchema.extend({
  review_id: z.string().uuid(),
});

export async function updatePerformanceReview(formData: FormData): Promise<StaffRecordResult> {
  const parsed = performanceReviewUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid review." };
  return done("/staff/staff-records/performance-reviews/update", {
    review_id: parsed.data.review_id,
    ...reviewBody(parsed.data),
  });
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

  const result = await apiAction<{ row: unknown; schedule: unknown }>("/staff/staff-records/save", {
    account_id: parsed.data.accountId,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    workdays: schedule?.data.workdays ?? null,
    start_time: schedule?.data.startTime ?? null,
    end_time: schedule?.data.endTime ?? null,
    grace_minutes: schedule?.data.graceMinutes ?? null,
  });
  if (result.error !== undefined) return { error: result.error };

  const response = saveStaffRecordResponseSchema.safeParse({ profile: result.row, schedule: result.schedule });
  if (!response.success) return { error: "Staff record returned invalid shape." };
  if (schedule?.data && response.data.schedule?.employee_id !== parsed.data.accountId) {
    return { error: "Staff record returned invalid shape." };
  }
  return { success: true, row: response.data.profile, schedule: response.data.schedule };
}

export async function setAccountState(formData: FormData): Promise<StaffRecordRpcResult> {
  const parsed = updateAccountStateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid account state." };

  const result = await apiAction<{ row: unknown }>("/admin/account-state", {
    account_id: parsed.data.accountId,
    state: parsed.data.state,
  });
  if (result.error !== undefined) return { error: result.error };

  const response = staffRecordProfileResponseSchema.safeParse(result.row);
  if (!response.success) return { error: "Account state returned invalid shape." };
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
