"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import {
  type AttachmentMeta,
  attachmentError,
  attachmentMimeType,
  MESSAGE_ATTACHMENT_TYPES,
  REQUEST_ATTACHMENT_MAX_COUNT,
  REQUEST_ATTACHMENTS_BUCKET,
} from "@/lib/inquiries/attachments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { employeeRequestSchema, requestReviewSchema } from "@/lib/validation/phase6";

import { randomUUID } from "node:crypto";

type Phase6ActionResult = { error: string } | { success: true };

const REQUEST_REVIEWERS = ["ceo", "account_manager"];

const requestProofSchema = z.object({
  path: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  type: z.string(),
  size: z.coerce.number().int(),
});

type RequestProof = z.infer<typeof requestProofSchema>;

const requestProofsSchema = z.array(requestProofSchema).max(REQUEST_ATTACHMENT_MAX_COUNT);

// T06: proof files go browser -> storage on a signed URL inside the caller's folder, so the 4 MB
// Server Action body limit does not apply.
export async function prepareRequestUploads(
  files: AttachmentMeta[],
): Promise<{ error: string } | { uploads: { path: string; token: string }[] }> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };
  if (files.length > REQUEST_ATTACHMENT_MAX_COUNT) {
    return { error: `Attach at most ${REQUEST_ATTACHMENT_MAX_COUNT} files.` };
  }
  for (const file of files) {
    const fileError = attachmentError(file);
    if (fileError) return { error: fileError };
  }

  const bucket = createAdminClient().storage.from(REQUEST_ATTACHMENTS_BUCKET);
  const uploads: { path: string; token: string }[] = [];
  for (const file of files) {
    const path = `${user.user.id}/${randomUUID()}.${MESSAGE_ATTACHMENT_TYPES[attachmentMimeType(file)]}`;
    const { data, error } = await bucket.createSignedUploadUrl(path);
    if (error || !data) return { error: error?.message ?? "Could not prepare the upload." };
    uploads.push({ path: data.path, token: data.token });
  }
  return { uploads };
}

// The paths come back from the browser, so each one must sit in the caller's own folder.
function readProofs(formData: FormData, employeeId: string): { proofs: RequestProof[] } | { error: string } {
  const raw = formData.get("proofs");
  if (typeof raw !== "string" || !raw.trim()) return { proofs: [] };

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { error: "Invalid proof files. Please attach them again." };
  }
  const parsed = requestProofsSchema.safeParse(decoded);
  if (!parsed.success) return { error: "Invalid proof files. Please attach them again." };

  for (const proof of parsed.data) {
    if (!proof.path.startsWith(`${employeeId}/`)) {
      return { error: "Invalid proof files. Please attach them again." };
    }
    const fileError = attachmentError({ name: proof.name, type: proof.type, size: proof.size });
    if (fileError) return { error: fileError };
  }
  return { proofs: parsed.data };
}

export async function submitEmployeeRequest(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = employeeRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const proofResult = readProofs(formData, user.user.id);
  if ("error" in proofResult) return { error: proofResult.error };
  const proofs = proofResult.proofs;

  const removeUploads = async () => {
    if (proofs.length === 0) return;
    await createAdminClient()
      .storage.from(REQUEST_ATTACHMENTS_BUCKET)
      .remove(proofs.map((proof) => proof.path));
  };

  const { data: request, error } = await supabase
    .from("employee_requests")
    .insert({
      employee_id: user.user.id,
      request_kind: parsed.data.request_kind,
      start_date: parsed.data.start_date,
      end_date: parsed.data.request_kind === "overtime" ? null : parsed.data.end_date || null,
      overtime_hours: parsed.data.request_kind === "overtime" ? parsed.data.overtime_hours : null,
      leave_reason: parsed.data.request_kind === "leave" ? parsed.data.leave_reason : null,
      reason: "reason" in parsed.data ? parsed.data.reason?.trim() || null : null,
    })
    .select("id")
    .single();
  if (error || !request) {
    await removeUploads();
    return { error: error?.message ?? "Could not save the request." };
  }

  // The attachment table has no INSERT policy: the admin client records the files, after the path
  // check above proved they belong to this employee.
  if (proofs.length > 0) {
    const { error: attachmentInsertError } = await createAdminClient()
      .from("employee_request_attachments")
      .insert(
        proofs.map((proof) => ({
          request_id: request.id,
          storage_path: proof.path,
          original_name: proof.name,
          file_kind: proof.type.startsWith("image/") ? "image" : "file",
          file_size: proof.size,
          uploader_id: user.user.id,
        })),
      );
    if (attachmentInsertError) {
      await removeUploads();
      return { error: `Your request was saved, but the proof files were not: ${attachmentInsertError.message}` };
    }
  }

  revalidatePath("/dashboard/employee-requests");
  return { success: true };
}

export async function cancelEmployeeRequest(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const requestId = formData.get("request_id") as string;
  const { error } = await supabase
    .from("employee_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("employee_id", user.user.id)
    .eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/dashboard/employee-requests");
  return { success: true };
}

export async function reviewEmployeeRequest(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !REQUEST_REVIEWERS.includes(role)) {
    return { error: "Not authorized to review requests" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = requestReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid review." };
  }

  const { error } = await supabase
    .from("employee_requests")
    .update({
      status: parsed.data.decision,
      reviewed_by: user.user.id,
      review_notes: parsed.data.review_notes || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.request_id)
    .eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/dashboard/employee-requests");
  return { success: true };
}
