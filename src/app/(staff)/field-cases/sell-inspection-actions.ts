"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type FieldActionResult = { error: string } | { success: true };

const FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_INSPECTION_PHOTOS = 10;

interface AssignedCase {
  id: string;
  transaction_id: string | null;
  case_kind: string;
  state: string;
  assigned_confidential_informant: string | null;
  mechanic_id: string | null;
  identity_confirmed_at: string | null;
  plate_confirmed_at: string | null;
  inspection_outcome: string | null;
}

// Loads a field case the caller is assigned to. The field roles cannot read transactions under
// RLS, so these steps run with the service role behind this assignment check.
async function assignedCase(
  fieldCaseId: unknown,
): Promise<{ userId: string; role: string; fieldCase: AssignedCase } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" };
  const role = await getCurrentRole();
  const id = z.string().uuid().safeParse(fieldCaseId);
  if (!id.success) return { error: "Invalid field case." };

  const { data: fieldCase } = await createAdminClient()
    .from("field_cases")
    .select(
      "id, transaction_id, case_kind, state, assigned_confidential_informant, mechanic_id, identity_confirmed_at, plate_confirmed_at, inspection_outcome",
    )
    .eq("id", id.data)
    .maybeSingle();
  if (!fieldCase) return { error: "Field case not found." };

  const assigned =
    (role === "confidential_informant" && fieldCase.assigned_confidential_informant === data.user.id) ||
    (role === "mechanic" && fieldCase.mechanic_id === data.user.id);
  if (!role || !assigned) return { error: "Only the assigned field team can update this case." };
  if (["completed", "cancelled"].includes(fieldCase.state)) return { error: "This field case is closed." };
  return { userId: data.user.id, role, fieldCase: fieldCase as AssignedCase };
}

function readFiles(formData: FormData, key: string): File[] {
  return formData.getAll(key).filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function fileError(files: File[], allowPdf: boolean): string | null {
  for (const file of files) {
    if (!FILE_EXTENSIONS[file.type] || (!allowPdf && file.type === "application/pdf")) {
      return allowPdf ? "Files must be JPEG, PNG, WebP or PDF." : "Photos must be JPEG, PNG or WebP images.";
    }
    if (file.size > MAX_FILE_SIZE) return "Each file must be 5MB or smaller.";
  }
  return null;
}

// Uploads into the transaction's document folder and records the document row.
async function storeDocument(
  transactionId: string,
  file: File,
  kind: "inspection_photo" | "expense_proof",
  uploaderId: string,
): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient();
  const path = `${transactionId}/${kind.replace(/_/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${FILE_EXTENSIONS[file.type]}`;
  const { error: uploadError } = await admin.storage.from("transaction-documents").upload(path, file);
  if (uploadError) return { error: uploadError.message };
  const { data, error } = await admin
    .from("transaction_documents")
    .insert({
      transaction_id: transactionId,
      document_kind: kind,
      storage_path: path,
      uploader_id: uploaderId,
      // Inspection photos are evidence attachments; expense proofs wait for the Head Accountant.
      verification_state: kind === "inspection_photo" ? "verified" : "pending",
    })
    .select("id")
    .single();
  if (error) {
    await admin.storage.from("transaction-documents").remove([path]);
    return { error: error.message };
  }
  return { id: data.id };
}

function done(fieldCaseId: string, transactionId: string | null): FieldActionResult {
  revalidatePath("/dashboard/field-cases");
  revalidatePath(`/dashboard/field-cases/${fieldCaseId}`);
  if (transactionId) revalidatePath(`/dashboard/transactions/${transactionId}`);
  return { success: true };
}

// Selling step 6: the Confidential Informant confirms the seller's identity; the Mechanic confirms the plate/chassis.
export async function confirmFieldCheck(formData: FormData): Promise<FieldActionResult> {
  const context = await assignedCase(formData.get("field_case_id"));
  if ("error" in context) return context;
  const check = formData.get("check");
  const { fieldCase, role, userId } = context;

  if (check === "identity" && role !== "confidential_informant") {
    return { error: "The Confidential Informant confirms the seller's identity." };
  }
  if (check === "plate" && role !== "mechanic") return { error: "The Mechanic confirms the plate and chassis." };
  if (check !== "identity" && check !== "plate") return { error: "Invalid check." };

  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("field_cases")
    .update(
      check === "identity"
        ? { identity_confirmed_at: now, identity_confirmed_by: userId }
        : { plate_confirmed_at: now, plate_confirmed_by: userId },
    )
    .eq("id", fieldCase.id);
  if (error) return { error: error.message };
  return done(fieldCase.id, fieldCase.transaction_id);
}

// Selling step 6: the Mechanic reports the inspection. No issue clears the car for payment;
// an issue goes to the Marketing Specialist for the Inspection Issue Report.
export async function reportInspection(formData: FormData): Promise<FieldActionResult> {
  const context = await assignedCase(formData.get("field_case_id"));
  if ("error" in context) return context;
  const { fieldCase, role, userId } = context;
  if (role !== "mechanic") return { error: "The Mechanic reports the inspection." };
  if (fieldCase.case_kind !== "acquisition" || !fieldCase.transaction_id) {
    return { error: "Only seller meet-up cases have an inspection report." };
  }
  if (fieldCase.inspection_outcome) return { error: "The inspection is already reported." };
  if (!fieldCase.identity_confirmed_at || !fieldCase.plate_confirmed_at) {
    return { error: "Confirm the seller's identity and the plate/chassis before reporting the inspection." };
  }

  const parsed = z
    .object({
      outcome: z.enum(["no_issues", "issue_found"]),
      issue_description: z.string().trim().max(2000).optional().or(z.literal("")),
      repair_estimate: z.coerce.number().min(0).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid inspection report." };
  const issueFound = parsed.data.outcome === "issue_found";
  if (issueFound && (!parsed.data.issue_description || parsed.data.repair_estimate === "")) {
    return { error: "Describe the issue and give the estimated total repair cost." };
  }

  const photos = readFiles(formData, "photos");
  if (issueFound && photos.length === 0) return { error: "Attach photos of the issue." };
  if (photos.length > MAX_INSPECTION_PHOTOS) return { error: `Attach at most ${MAX_INSPECTION_PHOTOS} photos.` };
  const photoError = fileError(photos, false);
  if (photoError) return { error: photoError };
  for (const photo of photos) {
    const stored = await storeDocument(fieldCase.transaction_id, photo, "inspection_photo", userId);
    if ("error" in stored) return stored;
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("field_cases")
    .update({
      inspection_outcome: parsed.data.outcome,
      issue_description: issueFound ? parsed.data.issue_description : null,
      repair_estimate: issueFound ? parsed.data.repair_estimate : null,
      inspected_at: now,
      state: "in_progress",
    })
    .eq("id", fieldCase.id);
  if (error) return { error: error.message };

  if (!issueFound) {
    await admin
      .from("sell_details")
      .update({ cleared_for_payment_at: now })
      .eq("transaction_id", fieldCase.transaction_id);
  }
  for (const role of issueFound ? ["marketing_specialist"] : ["marketing_specialist", "account_manager", "ceo"]) {
    await notify(
      admin,
      { role },
      {
        kind: issueFound ? "inspection_issue_found" : "sell_ready_for_payment",
        title: issueFound ? "Inspection found an issue" : "Seller's car cleared for payment",
        body: issueFound
          ? "The Mechanic found an issue at the seller meet-up. Create the Inspection Issue Report."
          : "The inspection found no issues. Request the purchase funds in Finance.",
        transactionId: fieldCase.transaction_id,
      },
    );
  }
  return done(fieldCase.id, fieldCase.transaction_id);
}

// Selling steps 11–12: each field worker files their meet-up expenses with a proof, purchased or not.
export async function fileFieldExpense(formData: FormData): Promise<FieldActionResult> {
  const context = await assignedCase(formData.get("field_case_id"));
  if ("error" in context) return context;
  const { fieldCase, userId } = context;
  // ponytail: proofs live in the transaction's document folder, so only transaction-linked cases can file.
  if (!fieldCase.transaction_id) return { error: "Expenses can only be filed on a case linked to a transaction." };

  const parsed = z
    .object({
      amount: z.coerce.number().min(0, "Amount cannot be negative."),
      description: z.string().trim().min(1, "Describe the expense.").max(500),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid expense." };

  const [proof] = readFiles(formData, "proof");
  if (!proof) return { error: "Attach the proof of expense." };
  const proofError = fileError([proof], true);
  if (proofError) return { error: proofError };

  const stored = await storeDocument(fieldCase.transaction_id, proof, "expense_proof", userId);
  if ("error" in stored) return stored;

  const { error } = await createAdminClient().from("field_case_expenses").insert({
    field_case_id: fieldCase.id,
    amount: parsed.data.amount,
    description: parsed.data.description,
    proof_document_id: stored.id,
    submitted_by: userId,
  });
  if (error) return { error: error.message };
  return done(fieldCase.id, fieldCase.transaction_id);
}
