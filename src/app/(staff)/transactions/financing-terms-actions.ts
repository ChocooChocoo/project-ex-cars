"use client";

// Phase 6: financing terms, the CEO's confirmation and opening the installment account call Laravel
// (backend/app/Http/Controllers/Finance/FinancingTermsController.php), which works out the total, the 10% Initial
// Downpayment and the monthly payment in exact centavos. Same exports and results as the old Server Actions.

import { apiAction } from "@/lib/api/action";

type FinancingResult = { error: string } | { success: true };

const form = (formData: FormData) => Object.fromEntries(formData);

export async function proposeFinancingTerms(formData: FormData): Promise<FinancingResult> {
  return apiAction("/staff/financing/propose", form(formData));
}

export async function reviewFinancingTerms(formData: FormData): Promise<FinancingResult> {
  return apiAction("/staff/financing/review", form(formData));
}

export async function confirmFinancingTerms(formData: FormData): Promise<FinancingResult> {
  return apiAction("/staff/financing/confirm", form(formData));
}

export async function completeFinancingAgreement(formData: FormData): Promise<FinancingResult> {
  return apiAction("/staff/financing/complete", form(formData));
}
