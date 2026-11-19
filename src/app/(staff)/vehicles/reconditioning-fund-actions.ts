"use client";

// Phase 6: shortfall fund requests and refund returns call Laravel
// (backend/app/Http/Controllers/Trading/ReconditioningController.php). Same exports and results as before.

import { apiAction, laravelForm } from "@/lib/api/action";

type ReconditioningResult = { error: string } | { success: true };

// §6 step 32: a shortfall during the work needs another itemised request with receipts.
export async function requestReconditioningFunds(formData: FormData): Promise<ReconditioningResult> {
  return apiAction("/staff/reconditioning/request-funds", laravelForm(formData));
}

export async function markReconditioningRefundReturned(formData: FormData): Promise<ReconditioningResult> {
  return apiAction("/staff/reconditioning/refund-returned", Object.fromEntries(formData));
}
