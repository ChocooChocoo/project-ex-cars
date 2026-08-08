"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { securityDutyCheckSchema, securityDutyCompleteSchema } from "@/lib/validation/phase6";

type Phase6ActionResult = { error: string } | { success: true };

const EVIDENCE_BUCKET = "security-evidence";

type UploadResult = { ok: true; path: string } | { ok: false; error: string };

async function uploadEvidence(userId: string, file: File): Promise<UploadResult> {
  if (!file || file.size === 0) return { ok: false, error: "An image file is required." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Image must be 5 MB or smaller." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { ok: false, error: "Only JPEG, PNG, or WebP images are allowed." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(EVIDENCE_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, path };
}

export async function startDutyCheck(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (role !== "head_security") return { error: "Only Head Security can start duty checks" };

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = securityDutyCheckSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid duty check." };
  }

  const { error } = await supabase.from("security_duty_checks").insert({
    security_id: user.user.id,
    duty_date: parsed.data.duty_date,
    notes: parsed.data.notes || null,
    status: "in_progress",
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/security-duty-checks");
  return { success: true };
}

export async function uploadDutyEvidence(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (role !== "head_security") return { error: "Only Head Security can upload evidence" };

  const dutyCheckId = formData.get("duty_check_id") as string;
  const slot = formData.get("slot") as "before" | "after";
  const file = formData.get("image") as File | null;
  if (!file) return { error: "No image file provided." };

  const pathResult = await uploadEvidence(user.user.id, file);
  if (!pathResult.ok) return { error: pathResult.error };

  const column = slot === "before" ? "before_image_path" : "after_image_path";
  const { error } = await supabase
    .from("security_duty_checks")
    .update({ [column]: pathResult.path, status: "in_progress" })
    .eq("id", dutyCheckId)
    .eq("security_id", user.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/security-duty-checks");
  return { success: true };
}

export async function completeDutyCheck(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (role !== "head_security") return { error: "Only Head Security can complete duty checks" };

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = securityDutyCompleteSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid duty check." };
  }

  const { data: check } = await supabase
    .from("security_duty_checks")
    .select("before_image_path, after_image_path, notes")
    .eq("id", parsed.data.duty_check_id)
    .eq("security_id", user.user.id)
    .single();
  if (!check) return { error: "Duty check not found." };

  if (!check.before_image_path || !check.after_image_path) {
    return { error: "Both before and after images are required to complete the check." };
  }

  const { error } = await supabase
    .from("security_duty_checks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      notes: parsed.data.notes || check.notes || null,
    })
    .eq("id", parsed.data.duty_check_id)
    .eq("security_id", user.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/security-duty-checks");
  return { success: true };
}
