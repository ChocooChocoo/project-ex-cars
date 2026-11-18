"use client";

// Phase 5: the Marketing Specialist's sell-offer steps call Laravel
// (backend/app/Http/Controllers/Trading/SellFlowController.php). Same exports and results as before.

import { apiAction } from "@/lib/api/action";

type SellActionResult = { error: string } | { success: true };

const send = (path: string, formData: FormData) =>
  apiAction(`/staff/trading/sell/${path}`, Object.fromEntries(formData)) as Promise<SellActionResult>;

export async function flagSellSubmission(formData: FormData): Promise<SellActionResult> {
  return send("flag-sell-submission", formData);
}

export async function proposePurchaseCeiling(formData: FormData): Promise<SellActionResult> {
  return send("propose-purchase-ceiling", formData);
}

export async function recordAgreedPrice(formData: FormData): Promise<SellActionResult> {
  return send("record-agreed-price", formData);
}

export async function createInspectionIssueReport(formData: FormData): Promise<SellActionResult> {
  return send("create-inspection-issue-report", formData);
}

export async function recordSellerResponse(formData: FormData): Promise<SellActionResult> {
  return send("record-seller-response", formData);
}
