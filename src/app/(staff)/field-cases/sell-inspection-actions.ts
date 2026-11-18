"use client";

// Phase 5: the seller meet-up steps call Laravel (backend/app/Http/Controllers/Field/FieldCaseActionController.php).
// Files (inspection photos, expense proofs) go up with the step that records them.

import { apiAction, laravelForm } from "@/lib/api/action";

type FieldActionResult = { error: string } | { success: true };

export async function confirmFieldCheck(formData: FormData): Promise<FieldActionResult> {
  return apiAction("/staff/field/confirm-field-check", Object.fromEntries(formData)) as Promise<FieldActionResult>;
}

export async function reportInspection(formData: FormData): Promise<FieldActionResult> {
  return apiAction("/staff/field/report-inspection", laravelForm(formData)) as Promise<FieldActionResult>;
}

export async function fileFieldExpense(formData: FormData): Promise<FieldActionResult> {
  return apiAction("/staff/field/file-field-expense", laravelForm(formData)) as Promise<FieldActionResult>;
}

export async function recordFieldPrice(
  fieldCaseId: string,
  input: { status: string; updatedPrice?: unknown; discountAmount?: unknown },
): Promise<FieldActionResult> {
  return apiAction("/staff/field/record-field-price", {
    field_case_id: fieldCaseId,
    ...input,
  }) as Promise<FieldActionResult>;
}
