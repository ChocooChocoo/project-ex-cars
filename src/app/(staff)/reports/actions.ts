"use client";

import { apiAction } from "@/lib/api/action";
import { reportSchema } from "@/lib/validation/phase6";

// Phase 7: browser adapters for the Laravel report endpoints (ReportController). The submitter is the session user.

type Phase6ActionResult = { error: string } | { success: true };

async function done(path: string, body: unknown): Promise<Phase6ActionResult> {
  const result = await apiAction(path, body);
  return result.error !== undefined ? { error: result.error } : { success: true };
}

export async function submitReport(formData: FormData): Promise<Phase6ActionResult> {
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid report." };
  return done("/staff/reports", {
    ...parsed.data,
    description: parsed.data.description || null,
    period_start: parsed.data.period_start || null,
    period_end: parsed.data.period_end || null,
  });
}

export async function reviewReport(formData: FormData): Promise<Phase6ActionResult> {
  return done("/staff/reports/review", { report_id: formData.get("report_id") });
}
