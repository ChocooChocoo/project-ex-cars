"use client";

import { apiAction } from "@/lib/api/action";
import { employeeRequestSchema, requestReviewSchema } from "@/lib/validation/phase6";

// Phase 7: browser adapters for the Laravel employee-request endpoints (EmployeeRequestController). The
// employee comes from the session; proof files go up with the form as `proofs[]` (max 3, 2 MB each).

type Phase6ActionResult = { error: string } | { success: true };

async function done(path: string, body: unknown): Promise<Phase6ActionResult> {
  const result = await apiAction(path, body);
  return result.error !== undefined ? { error: result.error } : { success: true };
}

export async function submitEmployeeRequest(formData: FormData): Promise<Phase6ActionResult> {
  const fields = Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string"));
  const parsed = employeeRequestSchema.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  return done("/staff/employee-requests", formData);
}

export async function cancelEmployeeRequest(formData: FormData): Promise<Phase6ActionResult> {
  return done("/staff/employee-requests/cancel", { request_id: formData.get("request_id") });
}

export async function reviewEmployeeRequest(formData: FormData): Promise<Phase6ActionResult> {
  const parsed = requestReviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid review." };
  return done("/staff/employee-requests/review", parsed.data);
}
