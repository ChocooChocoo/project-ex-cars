"use server";

// Phase 6 (money): shortfall fund requests and refund returns stay on Supabase until the payment phase moves
// them to Laravel. Split out of reconditioning-actions.ts unchanged when Phase 5 moved the rest to the browser.

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/lib/auth/server-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { releasedFundsCents } from "@/lib/transactions/reconditioning-funds";
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

const _partSchema = z.object({
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

function _releasedCents(job: JobRow): number {
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
