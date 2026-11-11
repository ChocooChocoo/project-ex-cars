"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  partsTotalCents,
  reconditioningRefundCents,
  releasedFundsCents,
} from "@/lib/transactions/reconditioning-funds";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads/compress-image";

type ReconditioningResult = { error: string } | { success: true };

const peso = (amount: unknown) => `₱${Number(amount).toLocaleString()}`;
const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_RECEIPT_BYTES = MAX_UPLOAD_BYTES;

type FundRequestRow = {
  amount_cents?: unknown;
  disbursement_requests?: { status?: string | null } | null;
};

type JobRow = Record<string, unknown> & {
  reconditioning_fund_requests?: FundRequestRow[];
  disbursement_requests?: { status?: string | null; amount_cents?: unknown } | null;
  vehicle_id: string;
  transaction_id: string | null;
};

const partSchema = z.object({
  part_name: z.string().trim().min(1, "Name every part.").max(200),
  replacement_brand: z.string().trim().min(1, "Give the replacement brand.").max(200),
  estimated_cost: z.coerce.number().min(0, "An estimate cannot be negative."),
});

async function actorWith(roles: string[]): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" };
  const role = await getCurrentRole();
  if (!role || !roles.includes(role)) return { error: "Not authorized for this reconditioning step." };
  return { userId: data.user.id };
}

async function loadJob(jobId: unknown): Promise<JobRow | null> {
  const id = z.string().uuid().safeParse(jobId);
  if (!id.success) return null;
  const { data } = await createAdminClient()
    .from("reconditioning_jobs")
    .select(
      "*, disbursement_requests(status, amount_cents), reconditioning_parts(*), reconditioning_fund_requests(*, reconditioning_fund_receipts(*), disbursement_requests(status))",
    )
    .eq("id", id.data)
    .maybeSingle();
  return data as JobRow | null;
}

function releasedCents(job: JobRow): number {
  return releasedFundsCents(job.reconditioning_fund_requests ?? [], job.disbursement_requests ?? null);
}

function done(vehicleId: string): ReconditioningResult {
  revalidatePath(`/dashboard/vehicles/${vehicleId}`);
  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/financing");
  return { success: true };
}

async function notifyRole(
  role: string,
  title: string,
  body: string,
  reference: { table: string; id: string | null } | null,
) {
  await createAdminClient()
    .from("notifications")
    .insert({
      recipient_role: role,
      kind: "reconditioning",
      title,
      body,
      reference_table: reference?.id ? reference.table : null,
      reference_id: reference?.id ?? null,
    });
}

function transactionReference(job: JobRow) {
  return job.transaction_id ? { table: "transactions", id: job.transaction_id } : null;
}

// §6 steps 27–30: the Mechanic's Overall Vehicle Status Report and per-part restoration estimate,
// sent as a fund request for the Head Accountant to release.
export async function submitReconditioningReport(formData: FormData): Promise<ReconditioningResult> {
  const who = await actorWith(["mechanic"]);
  if ("error" in who) return who;

  let partsInput: unknown = [];
  try {
    partsInput = JSON.parse(String(formData.get("parts") ?? "[]"));
  } catch {
    return { error: "Add at least one valid part." };
  }

  const parsed = z
    .object({
      status_report: z.string().trim().min(1, "Describe the car's overall condition.").max(4000),
      parts: z.array(partSchema).min(1, "Add at least one part."),
    })
    .safeParse({ status_report: formData.get("status_report"), parts: partsInput });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid report." };

  const job = await loadJob(formData.get("job_id"));
  if (!job) return { error: "Reconditioning job not found." };
  if (job.state !== "awaiting_report") return { error: "This car is not waiting for a status report." };
  if (job.mechanic_id && job.mechanic_id !== who.userId) {
    return { error: "Only the assigned Mechanic can report on this car." };
  }

  // T10: every row of the parts table carries a photo of the part to repair or replace.
  const photos = parsed.data.parts.map((_, index) => formData.get(`part_photo_${index}`));
  if (photos.some((photo) => !(photo instanceof File) || photo.size === 0)) {
    return { error: "Add a photo of every part." };
  }
  const photoFiles = photos as File[];
  if (photoFiles.some((photo) => !RECEIPT_TYPES[photo.type] || photo.size > MAX_RECEIPT_BYTES)) {
    return { error: "Part photos must be JPEG, PNG or WebP images of 2 MB or less." };
  }

  const admin = createAdminClient();
  const totalCents = partsTotalCents(parsed.data.parts);
  const summary = parsed.data.parts.map((part) => `${part.part_name} (${part.replacement_brand})`).join(", ");
  const photoPaths: string[] = [];
  for (const [index, photo] of photoFiles.entries()) {
    const path = `parts/${job.id}/${index}-${Date.now()}.${RECEIPT_TYPES[photo.type]}`;
    const { error: uploadError } = await admin.storage.from("reconditioning-receipts").upload(path, photo);
    if (uploadError) return { error: uploadError.message };
    photoPaths.push(path);
  }

  const { error: deletePartsError } = await admin.from("reconditioning_parts").delete().eq("job_id", job.id);
  if (deletePartsError) return { error: deletePartsError.message };
  const { error: partsError } = await admin.from("reconditioning_parts").insert(
    parsed.data.parts.map((part, index) => ({
      job_id: job.id,
      part_name: part.part_name,
      replacement_brand: part.replacement_brand,
      estimated_cost_cents: Math.round(part.estimated_cost * 100),
      photo_path: photoPaths[index],
    })),
  );
  if (partsError) return { error: partsError.message };

  const { data: request, error: requestError } = await admin
    .from("disbursement_requests")
    .insert({
      title: "Reconditioning fund",
      amount_cents: totalCents,
      purpose: `Repair and reconditioning: ${summary.slice(0, 200)}`,
      status: "submitted",
      requested_by: who.userId,
    })
    .select("id")
    .single();
  if (requestError) return { error: requestError.message };

  const { error: fundError } = await admin.from("reconditioning_fund_requests").insert({
    job_id: job.id,
    disbursement_id: request.id,
    amount_cents: totalCents,
    reason: "Initial parts and labor estimate",
    state: "submitted",
    created_by: who.userId,
  });
  if (fundError) {
    await admin.from("disbursement_requests").delete().eq("id", request.id);
    return { error: fundError.message };
  }

  const { error } = await admin
    .from("reconditioning_jobs")
    .update({
      state: "awaiting_funds",
      status_report: parsed.data.status_report,
      required_parts: summary,
      estimated_cost: totalCents / 100,
      disbursement_id: request.id,
      mechanic_id: who.userId,
    })
    .eq("id", job.id);
  if (error) return { error: error.message };

  await notifyRole(
    "head_accountant",
    "Reconditioning fund request",
    `The Mechanic estimates ${peso(totalCents / 100)} to recondition a car. Review the parts table and release it from Finance.`,
    transactionReference(job),
  );
  return done(job.vehicle_id);
}

// §6 step 31: work starts once the Head Accountant has released the funds.
export async function startReconditioning(formData: FormData): Promise<ReconditioningResult> {
  const who = await actorWith(["mechanic"]);
  if ("error" in who) return who;
  const job = await loadJob(formData.get("job_id"));
  if (!job) return { error: "Reconditioning job not found." };
  if (job.state !== "awaiting_funds") return { error: "This job is not waiting for funds." };
  if (job.mechanic_id && job.mechanic_id !== who.userId) {
    return { error: "Only the assigned Mechanic can start this job." };
  }
  if (releasedCents(job) <= 0) return { error: "Start once the Head Accountant releases the funds." };

  const { error } = await createAdminClient()
    .from("reconditioning_jobs")
    .update({ state: "in_progress" })
    .eq("id", job.id);
  if (error) return { error: error.message };
  return done(job.vehicle_id);
}

// §6 step 32: a shortfall during the work needs another itemised request with receipts.
export async function requestReconditioningFunds(formData: FormData): Promise<ReconditioningResult> {
  const who = await actorWith(["mechanic"]);
  if ("error" in who) return who;
  const parsed = z
    .object({
      amount: z.coerce.number().positive("Enter the extra amount needed."),
      shortfall_reason: z.string().trim().min(10, "Explain why the funds ran short.").max(2000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const job = await loadJob(formData.get("job_id"));
  if (!job) return { error: "Reconditioning job not found." };
  if (job.state !== "in_progress") return { error: "Request extra funds only while repairs are in progress." };
  if (job.mechanic_id && job.mechanic_id !== who.userId) {
    return { error: "Only the assigned Mechanic can request funds." };
  }

  const files = formData.getAll("receipts").filter((file): file is File => file instanceof File && file.size > 0);
  if (files.length === 0) return { error: "Attach at least one receipt photo." };
  for (const file of files) {
    if (!RECEIPT_TYPES[file.type]) return { error: "Receipts must be JPEG, PNG or WebP photos." };
    if (file.size > MAX_RECEIPT_BYTES) return { error: "Each receipt must be 2 MB or smaller." };
  }

  const admin = createAdminClient();
  const amountCents = Math.round(parsed.data.amount * 100);
  const uploaded: string[] = [];
  for (const file of files) {
    const path = `${job.id}/${crypto.randomUUID()}.${RECEIPT_TYPES[file.type]}`;
    const { error } = await admin.storage.from("reconditioning-receipts").upload(path, file);
    if (error) {
      if (uploaded.length > 0) await admin.storage.from("reconditioning-receipts").remove(uploaded);
      return { error: error.message };
    }
    uploaded.push(path);
  }

  const { data: request, error: requestError } = await admin
    .from("disbursement_requests")
    .insert({
      title: "Reconditioning shortfall",
      amount_cents: amountCents,
      purpose: parsed.data.shortfall_reason.slice(0, 200),
      status: "submitted",
      requested_by: who.userId,
    })
    .select("id")
    .single();
  if (requestError) {
    await admin.storage.from("reconditioning-receipts").remove(uploaded);
    return { error: requestError.message };
  }

  const { data: fundRequest, error: fundError } = await admin
    .from("reconditioning_fund_requests")
    .insert({
      job_id: job.id,
      disbursement_id: request.id,
      amount_cents: amountCents,
      reason: "Reconditioning shortfall",
      shortfall_reason: parsed.data.shortfall_reason,
      state: "submitted",
      created_by: who.userId,
    })
    .select("id")
    .single();
  if (fundError) {
    await admin.from("disbursement_requests").delete().eq("id", request.id);
    await admin.storage.from("reconditioning-receipts").remove(uploaded);
    return { error: fundError.message };
  }

  const { error: receiptError } = await admin.from("reconditioning_fund_receipts").insert(
    uploaded.map((path) => ({
      fund_request_id: fundRequest.id,
      storage_path: path,
      uploaded_by: who.userId,
    })),
  );
  if (receiptError) return { error: receiptError.message };

  await notifyRole(
    "head_accountant",
    "Reconditioning shortfall",
    `The Mechanic needs ${peso(amountCents / 100)} more. ${parsed.data.shortfall_reason}`,
    transactionReference(job),
  );
  return done(job.vehicle_id);
}

// §6 steps 34–36: the final repair report closes the job; leftover funds go back to the Head Accountant.
export async function completeReconditioning(formData: FormData): Promise<ReconditioningResult> {
  const who = await actorWith(["mechanic"]);
  if ("error" in who) return who;
  const parsed = z
    .object({
      final_report: z.string().trim().min(1, "Describe the repairs done and the car's condition.").max(4000),
      actual_cost: z.coerce.number().min(0, "Enter the actual cost."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid report." };

  const job = await loadJob(formData.get("job_id"));
  if (!job) return { error: "Reconditioning job not found." };
  if (job.state !== "in_progress") return { error: "This job is not in progress." };
  if (job.mechanic_id && job.mechanic_id !== who.userId) {
    return { error: "Only the assigned Mechanic can complete this job." };
  }

  const released = releasedCents(job);
  const actualCents = Math.round(parsed.data.actual_cost * 100);
  if (actualCents > released) {
    return {
      error: `The actual cost is ${peso((actualCents - released) / 100)} over the released funds. Request the shortfall first.`,
    };
  }
  const refund = reconditioningRefundCents(released, actualCents);

  const { error } = await createAdminClient()
    .from("reconditioning_jobs")
    .update({
      state: "completed",
      final_report: parsed.data.final_report,
      actual_cost: actualCents / 100,
      completed_at: new Date().toISOString(),
      refund_due_cents: refund,
    })
    .eq("id", job.id);
  if (error) return { error: error.message };

  if (refund > 0) {
    await notifyRole(
      "head_accountant",
      "Reconditioning refund due",
      `Repairs cost ${peso(actualCents / 100)}. The Mechanic must return ${peso(refund / 100)} of the released funds.`,
      transactionReference(job),
    );
  }
  await notifyRole(
    "marketing_specialist",
    "Reconditioned car ready for repricing",
    `Repairs cost ${peso(actualCents / 100)}. Review the reports and propose the revised price.`,
    { table: "vehicles", id: job.vehicle_id },
  );
  return done(job.vehicle_id);
}

export async function markReconditioningRefundReturned(formData: FormData): Promise<ReconditioningResult> {
  const who = await actorWith(["mechanic", "head_accountant"]);
  if ("error" in who) return who;
  const role = await getCurrentRole();
  const job = await loadJob(formData.get("job_id"));
  if (!job) return { error: "Reconditioning job not found." };
  if (job.state !== "completed") return { error: "This job is not completed." };
  if (role === "mechanic" && job.mechanic_id && job.mechanic_id !== who.userId) {
    return { error: "Only the assigned Mechanic can return the leftover funds." };
  }
  if (Number(job.refund_due_cents ?? 0) <= 0) return { error: "There is no leftover to return." };
  if (job.refunded_at) return { error: "The leftover is already marked returned." };

  const { error } = await createAdminClient()
    .from("reconditioning_jobs")
    .update({ refunded_at: new Date().toISOString() })
    .eq("id", job.id);
  if (error) return { error: error.message };

  await notifyRole(
    "head_accountant",
    "Reconditioning refund returned",
    `${role === "head_accountant" ? "The Head Accountant" : "The Mechanic"} recorded ${peso(Number(job.refund_due_cents) / 100)} returned to GCE.`,
    transactionReference(job),
  );
  return done(job.vehicle_id);
}

// §6 step 33: the Sales Manager re-processes the car's papers while it is reconditioned.
export async function markPapersProcessed(formData: FormData): Promise<ReconditioningResult> {
  const who = await actorWith(["sales_manager"]);
  if ("error" in who) return who;
  const job = await loadJob(formData.get("job_id"));
  if (!job) return { error: "Reconditioning job not found." };
  if (job.papers_processed_at) return { error: "The papers are already re-processed." };

  const { error } = await createAdminClient()
    .from("reconditioning_jobs")
    .update({ papers_processed_at: new Date().toISOString(), papers_processed_by: who.userId })
    .eq("id", job.id);
  if (error) return { error: error.message };
  return done(job.vehicle_id);
}
