"use client";

// Phase 5: inquiry routing and viewing arrangements call Laravel
// (backend/app/Http/Controllers/Messaging/InquiryWorkflowController.php). The file keeps its name so the
// components' imports stay the same; nothing in it runs on a server any more.

import { type ActionResult, apiAction } from "@/lib/api/action";
import { createInquirySchema, scheduleArrangementSchema } from "@/lib/validation/inquiries";

export async function createInquiry(formData: FormData) {
  const parsed = createInquirySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid inquiry." } as ActionResult<{ id: string }>;
  return apiAction<{ id: string }>("/inquiries", parsed.data);
}

export async function assignInquiry(inquiryId: string, role: "account_manager" | "sales_manager") {
  return apiAction(`/inquiries/${encodeURIComponent(inquiryId)}/assign`, { role });
}

export async function scheduleArrangement(formData: FormData) {
  const parsed = scheduleArrangementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid arrangement." } as ActionResult<{
      location: string | null;
    }>;
  }
  return apiAction<{ location: string | null }>("/staff/arrangements", parsed.data);
}

export async function handoffInquiry(inquiryId: string) {
  return apiAction(`/inquiries/${encodeURIComponent(inquiryId)}/handoff`);
}

export async function acceptHandoff(inquiryId: string) {
  return apiAction(`/inquiries/${encodeURIComponent(inquiryId)}/accept-handoff`);
}

export async function reviewReport(reportId: string, decision: string) {
  return apiAction(`/staff/message-reports/${encodeURIComponent(reportId)}/review`, { decision });
}
