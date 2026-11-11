"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { disbursementEventSchema, disbursementRequestSchema, financialEntrySchema } from "@/lib/validation/phase6";

type Phase6ActionResult = { error: string } | { success: true };

const ENTRY_RECORDERS = ["ceo", "head_accountant", "account_manager"];
const ENTRY_VERIFIERS = ["ceo", "head_accountant"];
const DISBURSEMENT_REQUESTERS = ["ceo", "account_manager", "confidential_informant"];
const DISBURSEMENT_ADVANCERS = ["ceo", "head_accountant"];

export async function recordFinancialEntry(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
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
  const supabase = await createServerSupabaseClient();
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
  const supabase = await createServerSupabaseClient();
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

const purchaseFundSchema = z.object({
  transaction_id: z.string().uuid(),
  amount_cents: z.coerce.number().int().min(1).optional(),
  travel_cents: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

// T10 Selling: after the price is agreed, the person who will pay the seller requests the funds. GCE Visit: the
// Marketing Specialist asks for the agreed price. Meet Halfway: the assigned Confidential Informant asks for the
// agreed price plus the estimated travel budget, in one request. The Head Accountant releases it before the
// inspection; the requester pays the seller once the car is cleared and returns any excess.
async function sellFundRequest(
  admin: ReturnType<typeof createAdminClient>,
  role: string,
  userId: string,
  transactionId: string,
  travelCents: number,
): Promise<{ error: string } | { amountCents: number; fieldCaseId: string; purpose: string }> {
  const { data: tx } = await admin
    .from("transactions")
    .select("id, current_state, sell_details(agreed_price, meetup_method)")
    .eq("id", transactionId)
    .maybeSingle();
  const sell = (Array.isArray(tx?.sell_details) ? tx.sell_details[0] : tx?.sell_details) as {
    agreed_price: number | null;
    meetup_method: string | null;
  } | null;
  if (tx?.current_state !== "approved" || sell?.agreed_price == null) {
    return { error: "Request the funds after the price is agreed with the seller." };
  }
  const { data: fieldCase } = await admin
    .from("field_cases")
    .select("id, assigned_confidential_informant")
    .eq("transaction_id", tx.id)
    .eq("case_kind", "acquisition")
    .neq("state", "cancelled")
    .maybeSingle();
  if (!fieldCase) return { error: "Create the field case first." };

  const halfway = sell.meetup_method !== "gce_visit";
  if (halfway && (role !== "confidential_informant" || fieldCase.assigned_confidential_informant !== userId)) {
    return { error: "On a Meet Halfway, the assigned Confidential Informant requests the funds." };
  }
  if (!halfway && role !== "marketing_specialist") {
    return { error: "On a GCE Visit, the Marketing Specialist requests the funds." };
  }
  const priceCents = Math.round(Number(sell.agreed_price) * 100);
  const travel = halfway ? travelCents : 0;
  const peso = (cents: number) => `₱${(cents / 100).toLocaleString("en-PH")}`;
  return {
    amountCents: priceCents + travel,
    fieldCaseId: fieldCase.id,
    purpose: halfway
      ? `Car payment ${peso(priceCents)} plus estimated travel ${peso(travel)} (Meet Halfway)`
      : `Car payment ${peso(priceCents)} (GCE Visit)`,
  };
}

export async function requestPurchaseFunds(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "account_manager", "marketing_specialist", "confidential_informant"].includes(role)) {
    return { error: "Not authorized to request purchase funds" };
  }

  const parsed = purchaseFundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid fund request." };
  }

  const admin = createAdminClient();
  const { data: kind } = await admin
    .from("transactions")
    .select("transaction_kind")
    .eq("id", parsed.data.transaction_id)
    .maybeSingle();
  if (!kind) return { error: "Transaction not found." };

  let insert: Record<string, unknown>;
  if (kind.transaction_kind === "sell") {
    const sell = await sellFundRequest(
      admin,
      role,
      user.user.id,
      parsed.data.transaction_id,
      parsed.data.travel_cents ?? 0,
    );
    if ("error" in sell) return sell;
    insert = {
      amount_cents: sell.amountCents,
      field_case_id: sell.fieldCaseId,
      purpose: sell.purpose,
      status: "submitted",
    };
  } else {
    if (!["ceo", "account_manager"].includes(role)) return { error: "Not authorized to request purchase funds" };
    if (!parsed.data.amount_cents) return { error: "Enter the amount." };
    insert = {
      amount_cents: parsed.data.amount_cents,
      purpose: `Release of funds for car purchase (transaction ${parsed.data.transaction_id})`,
      status: "draft",
    };
  }

  const { data: request, error } = await admin
    .from("disbursement_requests")
    .insert({
      title: "Car purchase fund",
      requested_by: user.user.id,
      notes: parsed.data.notes || null,
      purchase_transaction_id: parsed.data.transaction_id,
      ...insert,
    })
    .select("id")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "The funds for this car are already requested." : error.message };
  }

  await admin.from("disbursement_events").insert({
    disbursement_id: request.id,
    event_kind: "submitted",
    actor_id: user.user.id,
    notes: "Purchase fund request created — awaiting Head Accountant release.",
  });
  await notify(
    admin,
    { role: "head_accountant" },
    {
      kind: "purchase_funds_requested",
      title: "Car purchase funds requested",
      body: `${String(insert.purpose)}. Review and release it in Finance.`,
      transactionId: parsed.data.transaction_id,
    },
  );

  revalidatePath("/dashboard/finance");
  revalidatePath(`/dashboard/transactions/${parsed.data.transaction_id}`);
  return { success: true };
}

// T10: the requester (or the Head Accountant) records that the seller was paid, once the car is cleared.
export async function recordSellerPaid(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };
  const id = z.string().uuid().safeParse(formData.get("disbursement_id"));
  if (!id.success) return { error: "Fund request not found." };

  const { error } = await supabase.rpc("complete_purchase_disbursement", {
    p_disbursement_id: id.data,
    p_notes: "Seller paid by the fund requester",
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/field-cases");
  return { success: true };
}

export async function advanceDisbursement(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
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
    .select("status, purchase_transaction_id")
    .eq("id", parsed.data.disbursement_id)
    .single();
  if (!request) return { error: "Disbursement not found." };

  if (request.purchase_transaction_id && role !== "head_accountant") {
    return { error: "Only the Head Accountant can approve or release car-purchase funds." };
  }

  // Keep purchase payment, completion, posting and notifications in one database transaction.
  if (parsed.data.event_kind === "paid" && request.purchase_transaction_id) {
    const { error } = await supabase.rpc("complete_purchase_disbursement", {
      p_disbursement_id: parsed.data.disbursement_id,
      p_notes: parsed.data.notes || null,
    });
    if (error) return { error: error.message };
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/transactions");
    revalidatePath(`/dashboard/transactions/${request.purchase_transaction_id}`);
    revalidatePath("/dashboard/vehicles");
    return { success: true };
  }

  const nextStatus: Record<string, string> = {
    draft: "approved",
    submitted: "approved",
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

  // Keep the reconditioning ledger on the same step. Non-finance roles cannot read
  // `disbursement_requests`, so the request's own `state` is what the vehicle page shows.
  const fundState =
    parsed.data.event_kind === "approved"
      ? "approved"
      : ["released", "received", "paid"].includes(parsed.data.event_kind)
        ? "released"
        : parsed.data.event_kind === "rejected"
          ? "rejected"
          : null;
  if (fundState) {
    await createAdminClient()
      .from("reconditioning_fund_requests")
      .update({ state: fundState, updated_at: new Date().toISOString() })
      .eq("disbursement_id", parsed.data.disbursement_id);
  }

  revalidatePath("/dashboard/finance");
  return { success: true };
}

// Selling step 13: field expenses are reimbursed once the car GCE bought is sold on.
export async function markExpenseReimbursed(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };
  if ((await getCurrentRole()) !== "head_accountant") {
    return { error: "Only the Head Accountant can record reimbursements." };
  }

  const expenseId = z.string().uuid().safeParse(formData.get("expense_id"));
  if (!expenseId.success) return { error: "Invalid expense." };

  const admin = createAdminClient();
  const { data: expense } = await admin
    .from("field_case_expenses")
    .select("id, reimbursed_at, field_cases(vehicles(listing_state))")
    .eq("id", expenseId.data)
    .maybeSingle();
  if (!expense) return { error: "Expense not found." };
  if (expense.reimbursed_at) return { error: "This expense is already reimbursed." };
  const listingState = (expense.field_cases as { vehicles?: { listing_state?: string } | null } | null)?.vehicles
    ?.listing_state;
  if (listingState !== "sold") return { error: "Reimburse only after the vehicle is sold." };

  const { error } = await admin
    .from("field_case_expenses")
    .update({ reimbursed_at: new Date().toISOString(), reimbursed_by: user.user.id })
    .eq("id", expense.id)
    .is("reimbursed_at", null);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/finance");
  return { success: true };
}
