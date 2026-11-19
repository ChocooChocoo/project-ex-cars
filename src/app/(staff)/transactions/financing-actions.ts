"use client";

// Phase 5: the financing visit decision and the recovered car call Laravel
// (backend/app/Http/Controllers/Trading/FinancingVisitController.php). Terms, the agreement and the installment
// account call Laravel too (./financing-terms-actions.ts, Phase 6).

import { apiAction } from "@/lib/api/action";

export {
  completeFinancingAgreement,
  confirmFinancingTerms,
  proposeFinancingTerms,
  reviewFinancingTerms,
} from "./financing-terms-actions";

type FinancingResult = { error: string } | { success: true };

export async function recordVisitDecision(formData: FormData): Promise<FinancingResult> {
  return apiAction("/staff/trading/visit-decision", Object.fromEntries(formData)) as Promise<FinancingResult>;
}

export async function recordVehicleRecovered(formData: FormData): Promise<FinancingResult> {
  return apiAction("/staff/trading/vehicle-recovered", Object.fromEntries(formData)) as Promise<FinancingResult>;
}
