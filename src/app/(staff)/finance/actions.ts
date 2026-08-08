"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { disbursementEventSchema, disbursementRequestSchema, financialEntrySchema } from "@/lib/validation/phase6";

type Phase6ActionResult = { error: string } | { success: true };

const ENTRY_RECORDERS = ["ceo", "head_accountant", "account_manager"];
const ENTRY_VERIFIERS = ["ceo", "head_accountant"];
const DISBURSEMENT_REQUESTERS = ["ceo", "account_manager", "confidential_informant"];
const DISBURSEMENT_ADVANCERS = ["ceo", "head_accountant"];

export async function recordFinancialEntry(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !ENTRY_RECORDERS.includes(role)) {
    return { error: "Not authorized to record financial entries" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = financialEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid entry." };
  }

  const { error } = await supabase.from("financial_entries").insert({
    entry_kind: parsed.data.entry_kind,
    amount_cents: Math.round(parsed.data.amount_cents),
    transaction_id: parsed.data.transaction_id || null,
    field_case_id: parsed.data.field_case_id || null,
    description: parsed.data.description,
    recorded_by: user.user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function verifyFinancialEntry(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !ENTRY_VERIFIERS.includes(role)) {
    return { error: "Not authorized to verify entries" };
  }

  const entryId = formData.get("entry_id") as string;
  const { error } = await supabase
    .from("financial_entries")
    .update({ verified_by: user.user.id, verified_at: new Date().toISOString() })
    .eq("id", entryId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function createDisbursementRequest(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !DISBURSEMENT_REQUESTERS.includes(role)) {
    return { error: "Not authorized to create disbursement requests" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = disbursementRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const { data: request, error } = await supabase
    .from("disbursement_requests")
    .insert({
      title: parsed.data.title,
      amount_cents: Math.round(parsed.data.amount_cents),
      purpose: parsed.data.purpose,
      status: "draft",
      requested_by: user.user.id,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();
  if (error) return { error: error.message };

  await supabase.from("disbursement_events").insert({
    disbursement_id: request.id,
    event_kind: "submitted",
    actor_id: user.user.id,
    notes: "Request created.",
  });

  revalidatePath("/dashboard/finance");
  return { success: true };
}

export async function advanceDisbursement(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !DISBURSEMENT_ADVANCERS.includes(role)) {
    return { error: "Not authorized to advance disbursements" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = disbursementEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid action." };
  }

  const { data: request } = await supabase
    .from("disbursement_requests")
    .select("status")
    .eq("id", parsed.data.disbursement_id)
    .single();
  if (!request) return { error: "Disbursement not found." };

  const nextStatus: Record<string, string> = {
    draft: "approved",
    approved: "released",
    released: "received",
    received: "paid",
  };

  if (parsed.data.event_kind === "rejected") {
    if (request.status !== "draft" && request.status !== "submitted") {
      return { error: "Only draft or submitted requests can be rejected." };
    }
  } else if (nextStatus[request.status] !== parsed.data.event_kind) {
    return { error: `Cannot move from ${request.status} to ${parsed.data.event_kind}.` };
  }

  const updates: Record<string, unknown> = {
    status: parsed.data.event_kind === "rejected" ? "rejected" : parsed.data.event_kind,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.event_kind === "approved") {
    updates.approved_by = user.user.id;
  } else if (parsed.data.event_kind === "released") {
    updates.released_by = user.user.id;
  } else if (parsed.data.event_kind === "received") {
    updates.received_by = user.user.id;
  }

  const { error: updateError } = await supabase
    .from("disbursement_requests")
    .update(updates)
    .eq("id", parsed.data.disbursement_id);
  if (updateError) return { error: updateError.message };

  const { error: eventError } = await supabase.from("disbursement_events").insert({
    disbursement_id: parsed.data.disbursement_id,
    event_kind: parsed.data.event_kind,
    actor_id: user.user.id,
    notes: parsed.data.notes || null,
  });
  if (eventError) return { error: eventError.message };

  revalidatePath("/dashboard/finance");
  return { success: true };
}
