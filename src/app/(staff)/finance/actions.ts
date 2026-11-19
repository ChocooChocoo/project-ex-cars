"use client";

// Phase 6: the Finance page writes call Laravel (backend/app/Http/Controllers/Finance/FinanceController.php):
// ledger entries, disbursement requests and their release chain, car-purchase funds, the seller payment (one
// locked transaction that also routes the bought car) and field-expense reimbursement. Same exports and results.

import { apiAction } from "@/lib/api/action";

type Phase6ActionResult = { error: string } | { success: true };

const form = (formData: FormData) => Object.fromEntries(formData);

export async function recordFinancialEntry(formData: FormData): Promise<Phase6ActionResult> {
  return apiAction("/staff/finance/record-entry", form(formData));
}

export async function verifyFinancialEntry(formData: FormData): Promise<Phase6ActionResult> {
  return apiAction("/staff/finance/verify-entry", form(formData));
}

export async function createDisbursementRequest(formData: FormData): Promise<Phase6ActionResult> {
  return apiAction("/staff/finance/create-disbursement", form(formData));
}

// T10 Selling: the person who will pay the seller requests the funds; the Head Accountant releases them.
export async function requestPurchaseFunds(formData: FormData): Promise<Phase6ActionResult> {
  return apiAction("/staff/finance/request-purchase-funds", form(formData));
}

// T10: the requester (or the Head Accountant) records that the seller was paid, once the car is cleared.
export async function recordSellerPaid(formData: FormData): Promise<Phase6ActionResult> {
  return apiAction("/staff/finance/record-seller-paid", form(formData));
}

export async function advanceDisbursement(formData: FormData): Promise<Phase6ActionResult> {
  return apiAction("/staff/finance/advance", form(formData));
}

// Selling step 13: field expenses are reimbursed once the car GCE bought is sold on.
export async function markExpenseReimbursed(formData: FormData): Promise<Phase6ActionResult> {
  return apiAction("/staff/finance/mark-expense-reimbursed", form(formData));
}
