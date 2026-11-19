"use client";

import { apiAction } from "@/lib/api/action";

// Phase 7: browser adapters for the Laravel field-budget endpoints (FieldBudgetController). Laravel checks that
// the caller is the assigned Confidential Informant (or the requester, for a return) or the Head Accountant.

type BudgetResult = { error: string } | { success: true };

async function done(path: string, body: unknown): Promise<BudgetResult> {
  const result = await apiAction(path, body);
  return result.error !== undefined ? { error: result.error } : { success: true };
}

export async function requestFieldBudget(formData: FormData): Promise<BudgetResult> {
  return done("/staff/field-budget/request", {
    field_case_id: formData.get("field_case_id"),
    amount: formData.get("amount"),
    purpose: formData.get("purpose"),
  });
}

export async function recordBudgetReturn(formData: FormData): Promise<BudgetResult> {
  return done("/staff/field-budget/return", {
    field_case_id: formData.get("field_case_id"),
    returned: formData.get("returned"),
  });
}

export async function confirmBudgetReturn(formData: FormData): Promise<BudgetResult> {
  return done("/staff/field-budget/confirm-return", { disbursement_id: formData.get("disbursement_id") });
}
