"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadSellTransaction, moveSellTransaction } from "@/lib/transactions/sell-flow-server";
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
  amount_cents: z.coerce.number().int().min(1),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export async function requestPurchaseFunds(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "account_manager"].includes(role)) {
    return { error: "Not authorized to request purchase funds" };
  }

  const parsed = purchaseFundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid fund request." };
  }

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, transaction_kind, current_state, sell_details(agreed_price, cleared_for_payment_at)")
    .eq("id", parsed.data.transaction_id)
    .maybeSingle();
  if (!tx) return { error: "Transaction not found." };

  // Selling step 10: pay a seller only once the inspection or the seller's answer cleared the car,
  // and only the agreed price.
  if (tx.transaction_kind === "sell") {
    const sell = (Array.isArray(tx.sell_details) ? tx.sell_details[0] : tx.sell_details) as {
      agreed_price: number | null;
      cleared_for_payment_at: string | null;
    } | null;
    if (tx.current_state !== "approved" || !sell?.cleared_for_payment_at || sell.agreed_price === null) {
      return { error: "This seller's car is not cleared for payment yet." };
    }
    if (Math.round(Number(sell.agreed_price) * 100) !== parsed.data.amount_cents) {
      return { error: `Request exactly the agreed price of ₱${Number(sell.agreed_price).toLocaleString()}.` };
    }
  }

  const { data: request, error } = await supabase
    .from("disbursement_requests")
    .insert({
      title: "Car purchase fund",
      amount_cents: Math.round(parsed.data.amount_cents),
      purpose: `Release of funds for car purchase (transaction ${parsed.data.transaction_id})`,
      status: "draft",
      requested_by: user.user.id,
      notes: parsed.data.notes || null,
      purchase_transaction_id: parsed.data.transaction_id,
    })
    .select()
    .single();
  if (error) return { error: error.message };

  await supabase.from("disbursement_events").insert({
    disbursement_id: request.id,
    event_kind: "submitted",
    actor_id: user.user.id,
    notes: "Purchase fund request created — awaiting Head Accountant release.",
  });

  revalidatePath("/dashboard/finance");
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

  // Selling step 10: once the seller is paid, GCE owns the car; the payment is reported to the CEO.
  if (parsed.data.event_kind === "paid" && request.purchase_transaction_id) {
    const admin = createAdminClient();
    const tx = await loadSellTransaction(admin, request.purchase_transaction_id);
    if (tx && tx.current_state === "approved") {
      const moveError = await moveSellTransaction(
        admin,
        tx,
        user.user.id,
        { current_state: "completed" },
        "Seller paid by the Head Accountant",
      );
      if (moveError) return { error: moveError };
      await notify(
        admin,
        { role: "ceo" },
        {
          kind: "sell_payment_disbursed",
          title: "Seller payment disbursed",
          body: `The Head Accountant paid ₱${Number(tx.sell?.agreed_price ?? 0).toLocaleString()} for a seller's car.`,
          transactionId: tx.id,
        },
      );
    }
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
