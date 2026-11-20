"use client";

// Phase 5: the reconditioning workflow calls Laravel (backend/app/Http/Controllers/Trading/ReconditioningController.php).
// Shortfall fund requests and refund returns call Laravel too (./reconditioning-fund-actions.ts, Phase 6).

import { apiAction, laravelForm } from "@/lib/api/action";

export { markReconditioningRefundReturned, requestReconditioningFunds } from "./reconditioning-fund-actions";

type ReconditioningResult = { error: string } | { success: true };

export async function submitReconditioningReport(formData: FormData): Promise<ReconditioningResult> {
  return apiAction("/staff/reconditioning/report", laravelForm(formData)) as Promise<ReconditioningResult>;
}

export async function startReconditioning(formData: FormData): Promise<ReconditioningResult> {
  return apiAction("/staff/reconditioning/start", Object.fromEntries(formData)) as Promise<ReconditioningResult>;
}

export async function completeReconditioning(formData: FormData): Promise<ReconditioningResult> {
  return apiAction("/staff/reconditioning/complete", Object.fromEntries(formData)) as Promise<ReconditioningResult>;
}
