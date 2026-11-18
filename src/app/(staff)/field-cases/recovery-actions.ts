"use client";

// Phase 5: the recovery team's steps call Laravel (backend/app/Http/Controllers/Field/FieldCaseActionController.php).

import { apiAction, laravelForm } from "@/lib/api/action";
import { browserApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";

export async function advanceRecovery(form: FormData) {
  return apiAction("/staff/field/advance-recovery", Object.fromEntries(form));
}

export async function uploadTowEvidence(form: FormData) {
  return apiAction("/staff/field/upload-tow-evidence", laravelForm(form));
}

export async function updateRecoveryLocation(id: string, lat: number, lng: number) {
  try {
    await browserApi("POST", "/api/v1/staff/field/update-recovery-location", { field_case_id: id, lat, lng });
    return { success: true } as const;
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
