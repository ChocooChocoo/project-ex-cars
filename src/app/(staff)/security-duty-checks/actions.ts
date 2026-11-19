"use client";

import { apiAction } from "@/lib/api/action";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads/compress-image";
import { securityDutyCheckSchema, securityDutyCompleteSchema } from "@/lib/validation/phase6";

// Phase 7: browser adapters for the Laravel duty-check endpoints (SecurityDutyController, Head Security only).
// The evidence photo goes up as multipart into the private security-evidence bucket.

type Phase6ActionResult = { error: string } | { success: true };

async function done(path: string, body: unknown): Promise<Phase6ActionResult> {
  const result = await apiAction(path, body);
  return result.error !== undefined ? { error: result.error } : { success: true };
}

export async function startDutyCheck(formData: FormData): Promise<Phase6ActionResult> {
  const parsed = securityDutyCheckSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid duty check." };
  return done("/staff/security-duty-checks", parsed.data);
}

export async function uploadDutyEvidence(formData: FormData): Promise<Phase6ActionResult> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "No image file provided." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Image must be 2 MB or smaller." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { error: "Only JPEG, PNG, or WebP images are allowed." };
  }
  return done("/staff/security-duty-checks/evidence", formData);
}

export async function completeDutyCheck(formData: FormData): Promise<Phase6ActionResult> {
  const parsed = securityDutyCompleteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid duty check." };
  return done("/staff/security-duty-checks/complete", parsed.data);
}
