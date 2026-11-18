"use client";

// Phase 5: field case updates call Laravel (backend/app/Http/Controllers/Field/FieldCaseActionController.php),
// which checks that the caller oversees the case or is named on it.

import { apiAction } from "@/lib/api/action";

type Phase6ActionResult = { error: string } | { success: true };

export async function updateFieldCase(formData: FormData): Promise<Phase6ActionResult> {
  return apiAction("/staff/field/update-field-case", Object.fromEntries(formData)) as Promise<Phase6ActionResult>;
}
