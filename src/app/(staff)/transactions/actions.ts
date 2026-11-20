"use client";

// Phase 5: the staff buy-request actions run in the browser and call Laravel
// (backend/app/Http/Controllers/Trading/StaffTransactionController.php), which re-checks the role, the record
// and the state under row locks. Exports, arguments and results are the same as the old Server Actions.
// Payment recording, verification and waivers call Laravel too (./payment-actions.ts, Phase 6).

import { apiAction } from "@/lib/api/action";

export { markInstallmentWaived, recordAdvancePayment, recordPayment, verifyPayment } from "./payment-actions";

const form = (formData: FormData) => Object.fromEntries(formData);

export async function transitionTransaction(formData: FormData) {
  return apiAction("/staff/trading/transition", form(formData));
}

export async function recordBuyerDecline(formData: FormData) {
  return apiAction("/staff/trading/buyer-decline", form(formData));
}

export async function recordNoShow(formData: FormData) {
  return apiAction("/staff/trading/no-show", form(formData));
}

export async function promoteQueuedRequest(formData: FormData) {
  return apiAction("/staff/trading/promote", form(formData));
}

export async function verifyTransactionDocument(formData: FormData) {
  return apiAction("/staff/trading/verify-document", form(formData));
}

export async function createWalkInTransaction(formData: FormData) {
  return apiAction<{ id: string }>("/staff/trading/walk-in", form(formData));
}

export async function createFieldCase(formData: FormData) {
  return apiAction<{ id: string }>("/staff/trading/field-cases", form(formData));
}

export async function assignMechanic(formData: FormData) {
  return apiAction("/staff/trading/assign-mechanic", form(formData));
}

export async function instructRepossession(formData: FormData) {
  return apiAction<{ id: string }>("/staff/trading/repossession", form(formData));
}
