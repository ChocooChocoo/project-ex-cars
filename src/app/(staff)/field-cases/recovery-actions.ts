"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { logAuditEvent } from "@/lib/auth/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function assignedRecovery(id: unknown) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid recovery case." } as const;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = await getCurrentRole();
  if (!user) return { error: "Not authenticated" } as const;
  const admin = createAdminClient();
  const { data: fieldCase } = await admin.from("field_cases").select("*").eq("id", parsed.data).maybeSingle();
  const column =
    role === "confidential_informant"
      ? "assigned_confidential_informant"
      : role === "head_security"
        ? "head_security_id"
        : role === "mechanic"
          ? "mechanic_id"
          : null;
  if (fieldCase?.case_kind !== "recovery" || !column || fieldCase[column] !== user.id)
    return { error: "Only the assigned recovery team can act on this case." } as const;
  if (["completed", "cancelled"].includes(fieldCase.state)) return { error: "This recovery case is closed." } as const;
  return { admin, fieldCase, role, user, supabase };
}

export async function advanceRecovery(form: FormData) {
  const context = await assignedRecovery(form.get("field_case_id"));
  if (context.error) return { error: context.error };
  const { admin, fieldCase, role, user, supabase } = context;
  const next = form.get("state");
  const expected =
    fieldCase.state === "assigned" ? "accepted" : fieldCase.state === "accepted" ? "in_progress" : "completed";
  if (next !== expected) return { error: "Refresh this case before changing its status." };
  let mechanicId: string | null = null;
  if (next === "completed") {
    if (role !== "confidential_informant")
      return { error: "The assigned Confidential Informant must hand over the recovered car." };
    const parsed = z.string().uuid().safeParse(form.get("mechanic_id"));
    if (!parsed.success) return { error: "Choose an available mechanic." };
    mechanicId = parsed.data;
    const { data: active, error } = await supabase.rpc("is_active_mechanic", { p_account_id: mechanicId });
    if (error || !active) return { error: "The selected user is not an active mechanic." };
    const { data: tx } = await admin
      .from("transactions")
      .select("vehicle_id")
      .eq("id", fieldCase.transaction_id)
      .single();
    if (!tx?.vehicle_id) return { error: "Recovery vehicle not found." };
    const { data: openJob, error: readError } = await admin
      .from("reconditioning_jobs")
      .select("id")
      .eq("vehicle_id", tx.vehicle_id)
      .neq("state", "completed")
      .maybeSingle();
    if (readError) return { error: readError.message };
    const result = openJob
      ? await admin.from("reconditioning_jobs").update({ mechanic_id: mechanicId }).eq("id", openJob.id)
      : await admin
          .from("reconditioning_jobs")
          .insert({ vehicle_id: tx.vehicle_id, transaction_id: fieldCase.transaction_id, mechanic_id: mechanicId });
    if (result.error) return { error: result.error.message };
    const { error: vehicleError } = await admin
      .from("vehicles")
      .update({ listing_state: "repairing" })
      .eq("id", tx.vehicle_id);
    if (vehicleError) return { error: vehicleError.message };
    const { error: accountError } = await admin
      .from("installment_accounts")
      .update({ state: "repossessed" })
      .eq("purchase_transaction_id", fieldCase.transaction_id);
    if (accountError) return { error: accountError.message };
    await admin.from("transactions").update({ flow_status: "repossessed" }).eq("id", fieldCase.transaction_id);
    await admin.from("notifications").insert({
      recipient_id: mechanicId,
      kind: "reconditioning",
      title: "Recovered car handed over",
      body: "Inspect the recovered car and submit a per-part repair estimate.",
      reference_table: "vehicles",
      reference_id: tx.vehicle_id,
    });
  }
  const { error } = await admin
    .from("field_cases")
    .update({
      state: next,
      ...(mechanicId ? { mechanic_id: mechanicId, completion_date: new Date().toISOString() } : {}),
      ...(next === "accepted" ? { accepted_at: new Date().toISOString() } : {}),
      notes: `${fieldCase.notes ?? ""}\n${String(form.get("notes") ?? "").slice(0, 4000)}`,
    })
    .eq("id", fieldCase.id)
    .eq("state", fieldCase.state);
  if (error) return { error: error.message };
  await logAuditEvent({
    actorId: user.id,
    action: "recovery_status",
    recordKind: "field_cases",
    recordId: fieldCase.id,
    summary: `Recovery ${next}`,
  });
  revalidatePath(`/dashboard/field-cases/${fieldCase.id}`);
  revalidatePath("/dashboard/vehicles");
  return { success: true } as const;
}

export async function uploadTowEvidence(form: FormData) {
  const context = await assignedRecovery(form.get("field_case_id"));
  if (context.error) return { error: context.error };
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !file.size ||
    file.size > 10 * 1024 * 1024
  )
    return { error: "Choose a JPEG, PNG or WebP photo under 10 MB." };
  const { admin, fieldCase, user } = context;
  const path = `${fieldCase.transaction_id}/tow-${crypto.randomUUID()}`;
  const { error } = await admin.storage.from("transaction-documents").upload(path, file);
  if (error) return { error: error.message };
  const { error: recordError } = await admin.from("transaction_documents").insert({
    transaction_id: fieldCase.transaction_id,
    document_kind: "inspection_photo",
    storage_path: path,
    uploader_id: user.id,
    verification_state: "verified",
  });
  if (recordError) {
    await admin.storage.from("transaction-documents").remove([path]);
    return { error: recordError.message };
  }
  revalidatePath(`/dashboard/field-cases/${fieldCase.id}`);
  return { success: true } as const;
}

export async function updateRecoveryLocation(id: string, lat: number, lng: number) {
  const context = await assignedRecovery(id);
  if (context.error) return { error: context.error };
  if (context.fieldCase.state !== "in_progress") return { error: "Share location only while towing is in progress." };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return { error: "Invalid location." };
  const { error } = await context.admin
    .from("field_cases")
    .update({ last_lat: lat, last_lng: lng, last_located_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { error: error.message } : ({ success: true } as const);
}
