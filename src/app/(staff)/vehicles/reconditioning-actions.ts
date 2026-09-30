"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ReconditioningResult = { error: string } | { success: true };

const peso = (amount: unknown) => `₱${Number(amount).toLocaleString()}`;
const FUNDED = ["released", "received", "paid"];

async function actorWith(roles: string[]): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" };
  const role = await getCurrentRole();
  if (!role || !roles.includes(role)) return { error: "Not authorized for this reconditioning step." };
  return { userId: data.user.id };
}

async function loadJob(jobId: unknown) {
  const id = z.string().uuid().safeParse(jobId);
  if (!id.success) return null;
  const { data } = await createAdminClient()
    .from("reconditioning_jobs")
    .select("*, disbursement_requests(status)")
    .eq("id", id.data)
    .maybeSingle();
  return data;
}

function done(vehicleId: string): ReconditioningResult {
  revalidatePath(`/dashboard/vehicles/${vehicleId}`);
  revalidatePath("/dashboard/vehicles");
  return { success: true };
}

async function notifyRole(role: string, title: string, body: string, transactionId: string | null) {
  await createAdminClient()
    .from("notifications")
    .insert({
      recipient_role: role,
      kind: "reconditioning",
      title,
      body,
      reference_table: transactionId ? "transactions" : null,
      reference_id: transactionId,
    });
}

// §6 steps 27–30: the Mechanic's Overall Vehicle Status Report, required parts and restoration estimate,
// sent as a fund request for the Head Accountant to release.
export async function submitReconditioningReport(formData: FormData): Promise<ReconditioningResult> {
  const who = await actorWith(["mechanic"]);
  if ("error" in who) return who;
  const parsed = z
    .object({
      status_report: z.string().trim().min(1, "Describe the car's overall condition.").max(4000),
      required_parts: z.string().trim().min(1, "List the parts and repairs needed.").max(4000),
      estimated_cost: z.coerce.number().positive("Enter the estimated restoration cost."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid report." };

  const job = await loadJob(formData.get("job_id"));
  if (job?.state !== "awaiting_report") return { error: "This car is not waiting for a status report." };

  const admin = createAdminClient();
  const { data: request, error: requestError } = await admin
    .from("disbursement_requests")
    .insert({
      title: "Reconditioning fund",
      amount_cents: Math.round(parsed.data.estimated_cost * 100),
      purpose: `Repair and reconditioning of a repossessed car: ${parsed.data.required_parts.slice(0, 200)}`,
      status: "draft",
      requested_by: who.userId,
    })
    .select("id")
    .single();
  if (requestError) return { error: requestError.message };

  const { error } = await admin
    .from("reconditioning_jobs")
    .update({
      state: "awaiting_funds",
      status_report: parsed.data.status_report,
      required_parts: parsed.data.required_parts,
      estimated_cost: parsed.data.estimated_cost,
      disbursement_id: request.id,
      mechanic_id: who.userId,
    })
    .eq("id", job.id);
  if (error) return { error: error.message };

  await notifyRole(
    "head_accountant",
    "Reconditioning fund request",
    `The Mechanic estimates ${peso(parsed.data.estimated_cost)} to restore a repossessed car. Release it from Finance.`,
    job.transaction_id,
  );
  return done(job.vehicle_id);
}

// §6 step 31: work starts once the Head Accountant has released the funds.
export async function startReconditioning(formData: FormData): Promise<ReconditioningResult> {
  const who = await actorWith(["mechanic"]);
  if ("error" in who) return who;
  const job = await loadJob(formData.get("job_id"));
  if (job?.state !== "awaiting_funds") return { error: "This job is not waiting for funds." };
  const fundStatus = (job.disbursement_requests as { status?: string } | null)?.status ?? "";
  if (!FUNDED.includes(fundStatus)) return { error: "Start once the Head Accountant releases the funds." };

  const { error } = await createAdminClient()
    .from("reconditioning_jobs")
    .update({ state: "in_progress" })
    .eq("id", job.id);
  if (error) return { error: error.message };
  return done(job.vehicle_id);
}

// §6 steps 34–36: the final repair report closes the job; the car is ready for repricing.
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
  if (job?.state !== "in_progress") return { error: "This job is not in progress." };

  const { error } = await createAdminClient()
    .from("reconditioning_jobs")
    .update({
      state: "completed",
      final_report: parsed.data.final_report,
      actual_cost: parsed.data.actual_cost,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  if (error) return { error: error.message };

  await notifyRole(
    "marketing_specialist",
    "Reconditioned car ready for repricing",
    `Repairs cost ${peso(parsed.data.actual_cost)}. Review the reports and propose the revised price.`,
    job.transaction_id,
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
