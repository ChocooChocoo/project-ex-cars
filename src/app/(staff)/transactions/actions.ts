"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { logAuditEvent } from "@/lib/auth/audit";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canRecordNoShow, DOWNPAYMENT_WORKING_DAYS, verifiedPaid } from "@/lib/transactions/buy-flow";
import { finalizeBuySale, recordStandingEvent, releaseVisitSlots } from "@/lib/transactions/buy-flow-server";
import { generateInstallmentSchedule } from "@/lib/transactions/installments";
import { SELL_PAPER_KINDS } from "@/lib/transactions/sell-flow";
import type { TransactionState } from "@/lib/transactions/state-machine";
import { canTransition, reviewDueAt } from "@/lib/transactions/state-machine";
import { fieldCaseCreateSchema } from "@/lib/validation/phase6";
import { paymentRecordSchema, paymentTermsSchema, transitionSchema } from "@/lib/validation/transactions";

const PAPERWORK_DOCUMENT_KINDS = [
  "valid_id",
  "proof_of_billing",
  "invoice",
  "receipt",
  "sale_document",
  "sale_certificate",
  "payment_receipt",
] as const;
const paperworkSchema = z.object({
  transaction_id: z.string().uuid(),
  document_kind: z.enum(PAPERWORK_DOCUMENT_KINDS),
  id_type: z.string().optional().or(z.literal("")),
});

export async function transitionTransaction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role) return { error: "No role assigned" };

  const parsed = transitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid transition." };
  }

  const id = parsed.data.id;
  const toState = parsed.data.to_state;
  const reason = parsed.data.reason || null;

  const { data: tx } = await supabase
    .from("transactions")
    .select("current_state, transaction_kind, vehicle_id, customer_id")
    .eq("id", id)
    .single();

  if (!tx) return { error: "Transaction not found" };
  // Sell offers move only through the Marketing Specialist / CEO sell steps (sell-actions.ts, approvePrice).
  if (tx.transaction_kind === "sell") return { error: "Sell offers move through the sell review steps." };

  const fromState = tx.current_state as TransactionState;

  if (!canTransition(fromState, toState, role)) {
    return { error: "This action is not allowed for your role." };
  }

  // Use admin client for state transitions (bypass RLS for role-gated logic).
  const admin = await createAdminClient();

  // Two verified valid IDs + proof of billing are required before a purchase is
  // approved (not only at completion), so no unverified request is approved (G16).
  if (toState === "approved" && tx.transaction_kind === "buy") {
    const [{ count: verifiedIds }, { count: verifiedBilling }] = await Promise.all([
      admin
        .from("transaction_documents")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", id)
        .eq("document_kind", "valid_id")
        .eq("verification_state", "verified"),
      admin
        .from("transaction_documents")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", id)
        .eq("document_kind", "proof_of_billing")
        .eq("verification_state", "verified"),
    ]);
    if ((verifiedIds ?? 0) < 2 || (verifiedBilling ?? 0) < 1) {
      return {
        error:
          "Two verified valid IDs and a verified proof of billing are required before approval. Verify the buyer's documents first.",
      };
    }
  }

  // Two valid IDs + proof of billing must be verified before a purchase completes (G16).
  if (toState === "completed" && tx.transaction_kind === "buy") {
    const [{ count: verifiedIds }, { count: verifiedBilling }] = await Promise.all([
      admin
        .from("transaction_documents")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", id)
        .eq("document_kind", "valid_id")
        .eq("verification_state", "verified"),
      admin
        .from("transaction_documents")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", id)
        .eq("document_kind", "proof_of_billing")
        .eq("verification_state", "verified"),
    ]);
    if ((verifiedIds ?? 0) < 2 || (verifiedBilling ?? 0) < 1) {
      return {
        error: "Two verified valid IDs and a verified proof of billing are required before completing this purchase.",
      };
    }
    // §2 step 6: the car is marked sold once the payment is received.
    const { count: payments } = await admin
      .from("payment_records")
      .select("id", { count: "exact", head: true })
      .eq("transaction_id", id);
    if (!payments) return { error: "Record the buyer's payment before marking the car sold." };
    // §4 step 9: a delivered car is sold only once the team has handed it over.
    const { data: deliveryCase } = await admin
      .from("field_cases")
      .select("delivery_status")
      .eq("transaction_id", id)
      .eq("case_kind", "delivery")
      .neq("state", "cancelled")
      .maybeSingle();
    if (deliveryCase && deliveryCase.delivery_status !== "delivered") {
      return { error: "Mark the car sold after the delivery team reports it delivered." };
    }
  }

  const { error } = await admin
    .from("transactions")
    .update({
      current_state: toState,
      completed_at: ["completed", "cancelled", "rejected"].includes(toState) ? new Date().toISOString() : null,
      // Entering review opens the Sales Manager's 7-day window; any decision closes it.
      ...(toState === "under_review"
        ? { flow_status: "pending_sm_approval", review_due_at: reviewDueAt() }
        : { flow_status: null, review_due_at: null }),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Record status history.
  await admin.from("transaction_status_history").insert({
    transaction_id: id,
    from_state: fromState,
    to_state: toState,
    actor_id: user.user.id,
    reason,
  });

  if (tx.transaction_kind === "buy") {
    if (toState === "completed") await finalizeBuySale(admin, { id, vehicle_id: tx.vehicle_id }, user.user.id);
    if (toState === "rejected" || toState === "cancelled") await releaseVisitSlots(admin, id);
    if (toState === "approved" || toState === "rejected") {
      await notify(
        admin,
        { userId: tx.customer_id },
        {
          kind: `buy_request_${toState}`,
          title: toState === "approved" ? "Your purchase request is approved" : "Your purchase request was rejected",
          body:
            toState === "approved"
              ? "GCE will expect you on your scheduled visit."
              : `GCE did not approve your request.${reason ? ` Reason: ${reason}` : ""} Your visit slot has been released.`,
          transactionId: id,
        },
      );
    }
  }

  await logAuditEvent({
    actorId: user.user.id,
    action: `transaction_${toState}`,
    recordKind: "transactions",
    recordId: id,
    summary: `Transaction ${id} moved from ${fromState} to ${toState} by ${role}`,
  });

  revalidatePath("/dashboard/transactions");
  revalidatePath(`/dashboard/transactions/${id}`);
  return { success: true };
}

async function salesManager(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };
  const role = await getCurrentRole();
  if (!role || !["sales_manager", "ceo"].includes(role)) return { error: "Only the Sales Manager can do this." };
  return { userId: user.user.id };
}

async function loadBuyRequest(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data: tx } = await admin
    .from("transactions")
    .select(
      "id, customer_id, vehicle_id, current_state, queue_state, transaction_kind, viewing_arrangements(schedule, arrangement_kind, confirmation_state)",
    )
    .eq("id", id)
    .maybeSingle();
  if (tx?.transaction_kind !== "buy") return null;
  const live = (
    (tx.viewing_arrangements ?? []) as { schedule: string; arrangement_kind: string; confirmation_state: string }[]
  ).find((arrangement) => ["pending", "confirmed"].includes(arrangement.confirmation_state));
  return { ...tx, arrangement: live ?? null };
}

async function closeBuyRequest(
  admin: ReturnType<typeof createAdminClient>,
  tx: { id: string; current_state: string },
  actorId: string,
  flag: "declined_by_buyer" | "buyer_no_show" | "buyer_unavailable",
  reason: string,
) {
  const { error } = await admin
    .from("transactions")
    .update({
      current_state: "cancelled",
      flag,
      flow_status: null,
      review_due_at: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", tx.id);
  if (error) return error.message;
  await admin.from("transaction_status_history").insert({
    transaction_id: tx.id,
    from_state: tx.current_state,
    to_state: "cancelled",
    actor_id: actorId,
    reason,
  });
  await admin
    .from("viewing_arrangements")
    .update({ confirmation_state: "completed" })
    .eq("purchase_transaction_id", tx.id)
    .in("confirmation_state", ["pending", "confirmed"]);
  revalidatePath("/dashboard/transactions");
  revalidatePath(`/dashboard/transactions/${tx.id}`);
  return null;
}

// §2 step 5 / §3 step 7: the buyer saw the car and declined. The car was never reserved, so it stays
// listed. For a Meet Halfway request the Sales Manager classifies the reason: Not Legit is a strike
// that restricts the buyer to GCE visits.
export async function recordBuyerDecline(formData: FormData) {
  const actor = await salesManager();
  if ("error" in actor) return actor;

  const parsed = z
    .object({
      transaction_id: z.string().uuid(),
      classification: z.enum(["legit", "not_legit"]).optional(),
      reason: z.string().trim().max(500).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const admin = createAdminClient();
  const tx = await loadBuyRequest(admin, parsed.data.transaction_id);
  if (!tx) return { error: "Transaction not found." };
  if (tx.current_state !== "approved") return { error: "Only an approved request can be declined at the visit." };
  // Meet Halfway and Delivery declines are classified; a GCE visit decline is not.
  const classified = ["meetup", "delivery"].includes(tx.arrangement?.arrangement_kind ?? "");
  const delivery = tx.arrangement?.arrangement_kind === "delivery";
  if (classified && !parsed.data.classification) return { error: "Classify the decline as Legit or Not Legit." };

  const notLegit = classified && parsed.data.classification === "not_legit";
  const error = await closeBuyRequest(
    admin,
    tx,
    actor.userId,
    "declined_by_buyer",
    `Declined by buyer${classified ? ` (${notLegit ? "Not Legit, strike" : "Legit"})` : ""}${parsed.data.reason ? `: ${parsed.data.reason}` : ""}`,
  );
  if (error) return { error };
  if (notLegit) await recordStandingEvent(admin, tx.customer_id, "strike", actor.userId);

  // §4 step 8: a Legit decline refunds the downpayment within 2–3 working days through a Head Accountant
  // disbursement; a Not Legit decline forfeits it.
  if (delivery) {
    const { data: payments } = await admin
      .from("payment_records")
      .select("payment_kind, amount, verified_by")
      .eq("transaction_id", tx.id);
    const downpayment = verifiedPaid(payments ?? [], "downpayment");
    if (notLegit) {
      await admin
        .from("purchase_details")
        .update({ downpayment_forfeited_at: new Date().toISOString() })
        .eq("transaction_id", tx.id);
    } else if (downpayment > 0) {
      const { data: refund } = await admin
        .from("disbursement_requests")
        .insert({
          title: "Downpayment refund",
          amount_cents: Math.round(downpayment * 100),
          purpose: `Refund of a buyer's downpayment after a legitimate decline (transaction ${tx.id})`,
          status: "draft",
          requested_by: actor.userId,
          notes: `Refund within ${DOWNPAYMENT_WORKING_DAYS} working days.`,
        })
        .select("id")
        .single();
      if (refund) {
        await admin.from("disbursement_events").insert({
          disbursement_id: refund.id,
          event_kind: "submitted",
          actor_id: actor.userId,
          notes: "Downpayment refund — awaiting Head Accountant release.",
        });
      }
      await notify(
        admin,
        { role: "head_accountant" },
        {
          kind: "downpayment_refund",
          title: "Downpayment refund to release",
          body: `Refund ₱${downpayment.toLocaleString()} to the buyer within ${DOWNPAYMENT_WORKING_DAYS} working days.`,
          transactionId: tx.id,
        },
      );
    }
    await notify(
      admin,
      { userId: tx.customer_id },
      {
        kind: "delivery_declined",
        title: "Your purchase was closed",
        body: notLegit
          ? "The decline was not accepted as legitimate. Your downpayment is forfeited and your account is limited to GCE visits."
          : `Your downpayment will be refunded within ${DOWNPAYMENT_WORKING_DAYS} working days.`,
        transactionId: tx.id,
      },
    );
  }
  return { success: true };
}

// §3 step 6: the buyer did not arrive within 2 hours 30 minutes. One no-show; two restrict the buyer.
export async function recordNoShow(formData: FormData) {
  const actor = await salesManager();
  if ("error" in actor) return actor;
  const id = z.string().uuid().safeParse(formData.get("transaction_id"));
  if (!id.success) return { error: "Invalid request." };

  const admin = createAdminClient();
  const tx = await loadBuyRequest(admin, id.data);
  if (!tx) return { error: "Transaction not found." };
  const kind = tx.arrangement?.arrangement_kind;
  if (tx.current_state !== "approved" || !tx.arrangement || (kind !== "meetup" && kind !== "delivery")) {
    return { error: "Only an approved Meet Halfway or Delivery request can be marked as a no-show." };
  }
  const delivery = kind === "delivery";
  if (delivery) {
    // §4 step 7c: the team reached the address and the buyer, without notice, was not there.
    const { data: fieldCase } = await admin
      .from("field_cases")
      .select("delivery_status")
      .eq("transaction_id", tx.id)
      .eq("case_kind", "delivery")
      .neq("state", "cancelled")
      .maybeSingle();
    if (!["arriving", "delivered"].includes(fieldCase?.delivery_status ?? "")) {
      return { error: "Record the buyer as unavailable once the delivery team has arrived." };
    }
  } else if (!canRecordNoShow(tx.arrangement.schedule)) {
    return { error: "Wait 2 hours 30 minutes after the meet-up time before recording a no-show." };
  }

  const error = await closeBuyRequest(
    admin,
    tx,
    actor.userId,
    delivery ? "buyer_unavailable" : "buyer_no_show",
    delivery ? "Buyer unavailable at delivery; downpayment forfeited" : "Buyer didn't show up",
  );
  if (error) return { error };
  if (delivery) {
    await admin
      .from("purchase_details")
      .update({ downpayment_forfeited_at: new Date().toISOString() })
      .eq("transaction_id", tx.id);
  }
  const standing = await recordStandingEvent(admin, tx.customer_id, "no_show", actor.userId);
  await notify(
    admin,
    { userId: tx.customer_id },
    {
      kind: "buyer_no_show",
      title: "Your meet-up was recorded as a no-show",
      body: standing.gce_visit_only
        ? "This is your second no-show. From now on you can only buy through a GCE visit."
        : "This counts as one no-show. After two, you can only buy through a GCE visit.",
      transactionId: tx.id,
    },
  );
  return { success: true };
}

// §3 step 5: after a rejection, no-show or decline the Sales Manager picks the next On Hold request.
// Q11 default: a request still Active (even Overdue) must be decided first; the database allows one.
export async function promoteQueuedRequest(formData: FormData) {
  const actor = await salesManager();
  if ("error" in actor) return actor;
  const id = z.string().uuid().safeParse(formData.get("transaction_id"));
  if (!id.success) return { error: "Invalid request." };

  const admin = createAdminClient();
  const tx = await loadBuyRequest(admin, id.data);
  if (!tx) return { error: "Transaction not found." };
  if (tx.queue_state !== "on_hold" || tx.current_state !== "pending") return { error: "This request is not On Hold." };

  const { error } = await admin
    .from("transactions")
    .update({
      queue_state: "active",
      current_state: "under_review",
      flow_status: "pending_sm_approval",
      review_due_at: reviewDueAt(),
    })
    .eq("id", tx.id)
    .eq("queue_state", "on_hold");
  if (error?.code === "23505") return { error: "Another request for this car is still Active. Decide it first." };
  if (error) return { error: error.message };

  await admin.from("transaction_status_history").insert({
    transaction_id: tx.id,
    from_state: "pending",
    to_state: "under_review",
    actor_id: actor.userId,
    reason: "Promoted from On Hold to Active by the Sales Manager",
  });
  await notify(
    admin,
    { userId: tx.customer_id },
    {
      kind: "buy_request_active",
      title: "Your request is now Active",
      body: "The Sales Manager is now reviewing your request (up to 7 days).",
      transactionId: tx.id,
    },
  );
  revalidatePath("/dashboard/transactions");
  revalidatePath(`/dashboard/transactions/${tx.id}`);
  return { success: true };
}

export async function recordPayment(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "sales_manager", "account_manager", "head_accountant"].includes(role)) {
    return { error: "Not authorized" };
  }

  const parsed = paymentRecordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payment record." };
  }

  const transactionId = parsed.data.transaction_id;
  const installmentId = parsed.data.installment_id || null;

  const { error } = await supabase.from("payment_records").insert({
    transaction_id: transactionId,
    installment_id: installmentId ?? null,
    amount: parsed.data.amount,
    method: parsed.data.method,
    external_reference: parsed.data.external_reference || null,
    recorded_by: user.user.id,
    settlement_date: parsed.data.settlement_date,
    payment_kind: parsed.data.payment_kind || null,
  });

  if (error) return { error: error.message };

  // Update installment state if linked.
  if (installmentId) {
    await supabase
      .from("installments")
      .update({ state: "paid", payment_date: parsed.data.settlement_date })
      .eq("id", installmentId);
  }

  await logAuditEvent({
    actorId: user.user.id,
    action: "payment_recorded",
    recordKind: "payment_records",
    recordId: transactionId,
    summary: `Payment of PHP ${parsed.data.amount} recorded for transaction ${transactionId}`,
  });

  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/transactions/payments");
  return { success: true };
}

export async function verifyPayment(paymentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "head_accountant"].includes(role)) {
    return { error: "Not authorized" };
  }

  const { error } = await supabase.from("payment_records").update({ verified_by: user.user.id }).eq("id", paymentId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/transactions/payments");
  return { success: true };
}

export async function createPaymentTerms(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "sales_manager", "account_manager"].includes(role)) {
    return { error: "Not authorized" };
  }

  const parsed = paymentTermsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payment terms." };
  }

  const { error } = await supabase.from("payment_terms").insert({
    purchase_transaction_id: parsed.data.purchase_transaction_id,
    arrangement_description: parsed.data.arrangement_description,
    total_amount: parsed.data.total_amount,
    down_payment: parsed.data.down_payment,
    number_of_payments: parsed.data.number_of_payments,
    payment_frequency: parsed.data.payment_frequency,
    first_due_date: parsed.data.first_due_date,
    agreed_by: user.user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/transactions/${parsed.data.purchase_transaction_id}`);
  return { success: true };
}

export async function approvePaymentTerms(termsId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "account_manager", "head_accountant"].includes(role)) {
    return { error: "Not authorized" };
  }

  const { error } = await supabase
    .from("payment_terms")
    .update({
      state: "approved",
      approver_id: user.user.id,
      approval_date: new Date().toISOString(),
    })
    .eq("id", termsId);

  if (error) return { error: error.message };

  await logAuditEvent({
    actorId: user.user.id,
    action: "payment_terms_approved",
    recordKind: "payment_terms",
    recordId: termsId,
    summary: `Payment terms ${termsId} approved`,
  });

  revalidatePath("/dashboard/transactions");
  return { success: true };
}

export async function activatePaymentTerms(termsId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "account_manager"].includes(role)) {
    return { error: "Not authorized" };
  }

  const admin = await createAdminClient();

  const { data: terms } = await admin.from("payment_terms").select("*").eq("id", termsId).single();

  if (!terms) return { error: "Payment terms not found" };

  const schedule = generateInstallmentSchedule({
    totalAmount: Number(terms.total_amount),
    downPayment: Number(terms.down_payment),
    numberOfPayments: Number(terms.number_of_payments),
    firstDueDate: new Date(terms.first_due_date as string),
    frequency: terms.payment_frequency as never,
  });

  // Create installment account.
  const financed = Number(terms.total_amount) - Number(terms.down_payment);
  const { data: account, error: accountError } = await admin
    .from("installment_accounts")
    .insert({
      purchase_transaction_id: terms.purchase_transaction_id,
      financed_total: terms.total_amount,
      down_payment: terms.down_payment,
      opening_balance: financed,
      start_date: terms.first_due_date,
    })
    .select()
    .single();

  if (accountError) return { error: accountError.message };

  // Create installments.
  const { error: instError } = await admin.from("installments").insert(
    schedule.map((s) => ({
      account_id: account.id,
      sequence_no: s.sequenceNo,
      due_date: s.dueDate,
      amount_due: s.amountDue,
    })),
  );

  if (instError) return { error: instError.message };

  // Update terms state.
  await admin.from("payment_terms").update({ state: "active" }).eq("id", termsId);

  const userResult = await (await createServerSupabaseClient()).auth.getUser();
  await logAuditEvent({
    actorId: userResult.data.user?.id ?? "unknown",
    action: "payment_terms_activated",
    recordKind: "payment_terms",
    recordId: termsId,
    summary: `Payment terms ${termsId} activated, ${schedule.length} installments created`,
  });

  revalidatePath(`/dashboard/transactions/${terms.purchase_transaction_id}`);
  revalidatePath("/dashboard/transactions/installments");
  return { success: true };
}

export async function recordPaperwork(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "sales_manager", "account_manager", "head_accountant"].includes(role)) {
    return { error: "Not authorized" };
  }

  const parsed = paperworkSchema.safeParse({
    transaction_id: formData.get("transaction_id"),
    document_kind: formData.get("document_kind"),
    id_type: formData.get("id_type") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid paperwork." };
  }

  const transactionId = parsed.data.transaction_id;
  const documentKind = parsed.data.document_kind;
  const idType = parsed.data.id_type || null;
  const fileEntry = formData.get("file");
  if (fileEntry !== null && !(fileEntry instanceof File)) {
    return { error: "Select a valid file to upload." };
  }
  const file = fileEntry instanceof File ? fileEntry : null;
  const requiresVerification = documentKind === "valid_id" || documentKind === "proof_of_billing";
  if (requiresVerification && !file?.size) return { error: "Select a file to upload." };
  if (file && file.size === 0) return { error: "Select a file to upload." };

  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, transaction_kind")
    .eq("id", transactionId)
    .maybeSingle();
  if (!transaction) return { error: "Transaction not found." };
  if (requiresVerification && transaction.transaction_kind !== "buy") {
    return { error: "Valid IDs and proof of billing can only be recorded for purchases." };
  }

  let storagePath: string | null = null;

  if (file) {
    const fileExt = file.name.split(".").pop() ?? "bin";
    storagePath = `${transactionId}/${documentKind}-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("transaction-documents").upload(storagePath, file);
    if (uploadError) return { error: uploadError.message };
  }

  // Valid IDs and proof of billing require staff verification before the sale is
  // considered document-complete; other paperwork uploads are trusted.
  const { error } = await supabase.from("transaction_documents").insert({
    transaction_id: transactionId,
    document_kind: documentKind,
    id_type: idType,
    storage_path: storagePath,
    uploader_id: user.user.id,
    verification_state: requiresVerification ? "pending" : "verified",
  });

  // The metadata row is what makes the upload visible, so drop the object again
  // when the insert fails instead of leaving an orphaned private file behind.
  if (error) {
    if (storagePath) await supabase.storage.from("transaction-documents").remove([storagePath]);
    return { error: error.message };
  }

  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/transactions/paperwork");
  return { success: true };
}

export async function verifyTransactionDocument(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  // Task 32/33: the Head Accountant verifies purchase-document correctness, then
  // the CEO approves.  Verification is deliberately not open to the approving or
  // processing roles, so nobody can verify the paperwork for their own approval.
  // T01 Selling step 2: the Marketing Specialist verifies a seller's papers (checked per document below).
  if (!role || !["head_accountant", "marketing_specialist", "sales_manager"].includes(role)) {
    return { error: "Not authorized to verify purchase documents" };
  }

  const documentId = formData.get("document_id") as string;
  const decision = formData.get("decision") as string;
  if (!documentId || !["verified", "rejected"].includes(decision)) {
    return { error: "Invalid verification request." };
  }

  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("transaction_documents")
    .select("id, transaction_id, document_kind, verification_state")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };
  if (doc.verification_state !== "pending") {
    return { error: "Only pending documents can be verified or rejected." };
  }

  const { data: parent } = await admin
    .from("transactions")
    .select("transaction_kind")
    .eq("id", doc.transaction_id)
    .maybeSingle();
  const isSellPaper =
    parent?.transaction_kind === "sell" && (SELL_PAPER_KINDS as readonly string[]).includes(doc.document_kind);
  // §2 step 4: the Sales Manager checks a buyer's IDs and proof of billing; the Head Accountant
  // still verifies the rest.
  const allowed = isSellPaper
    ? role === "marketing_specialist"
    : role === "head_accountant" ||
      (role === "sales_manager" &&
        parent?.transaction_kind === "buy" &&
        ["valid_id", "proof_of_billing"].includes(doc.document_kind));
  if (!allowed) {
    return {
      error: isSellPaper
        ? "The Marketing Specialist verifies a seller's papers."
        : "This document is verified by the Head Accountant.",
    };
  }

  const { error } = await admin
    .from("transaction_documents")
    .update({ verification_state: decision, verifier_id: user.user.id })
    .eq("id", documentId);
  if (error) return { error: error.message };

  if (["valid_id", "proof_of_billing"].includes(doc.document_kind)) {
    const [{ count: verifiedIds }, { count: verifiedBilling }, { count: rejectedPrerequisites }] = await Promise.all([
      admin
        .from("transaction_documents")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", doc.transaction_id)
        .eq("document_kind", "valid_id")
        .eq("verification_state", "verified"),
      admin
        .from("transaction_documents")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", doc.transaction_id)
        .eq("document_kind", "proof_of_billing")
        .eq("verification_state", "verified"),
      admin
        .from("transaction_documents")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", doc.transaction_id)
        .in("document_kind", ["valid_id", "proof_of_billing"])
        .eq("verification_state", "rejected"),
    ]);
    const documentCheckState =
      (verifiedIds ?? 0) >= 2 && (verifiedBilling ?? 0) >= 1
        ? "verified"
        : (rejectedPrerequisites ?? 0) > 0
          ? "rejected"
          : "pending";

    await admin
      .from("purchase_details")
      .update({
        document_check_state: documentCheckState,
        checked_by: user.user.id,
        checked_at: new Date().toISOString(),
      })
      .eq("transaction_id", doc.transaction_id);
  }

  await logAuditEvent({
    actorId: user.user.id,
    action: `purchase_document_${decision}`,
    recordKind: "transaction_documents",
    recordId: documentId,
    summary: `Purchase document ${documentId} (${doc.document_kind}) ${decision}`,
  });

  revalidatePath(`/dashboard/transactions/${doc.transaction_id}`);
  return { success: true };
}

export async function assignInformant(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "sales_manager"].includes(role)) {
    return { error: "Not authorized" };
  }

  const transactionId = formData.get("transaction_id") as string;
  const informantId = formData.get("informant_id") as string;

  const { error } = await supabase
    .from("vehicle_requests")
    .update({ assigned_confidential_informant: informantId })
    .eq("transaction_id", transactionId);

  if (error) return { error: error.message };

  // Optionally create field case.
  await supabase.from("field_cases").insert({
    transaction_id: transactionId,
    case_kind: "sourcing",
    assigned_confidential_informant: informantId,
  });

  revalidatePath(`/dashboard/transactions/${transactionId}`);
  return { success: true };
}

export async function markInstallmentWaived(installmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "account_manager", "head_accountant"].includes(role)) {
    return { error: "Not authorized" };
  }

  const { error } = await supabase.from("installments").update({ state: "waived" }).eq("id", installmentId);

  if (error) return { error: error.message };

  await logAuditEvent({
    actorId: user.user.id,
    action: "installment_waived",
    recordKind: "installments",
    recordId: installmentId,
    summary: `Installment ${installmentId} waived`,
  });

  revalidatePath("/dashboard/transactions/installments");
  return { success: true };
}

export async function createWalkInTransaction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "sales_manager", "account_manager"].includes(role)) {
    return { error: "Not authorized" };
  }

  const customerId = formData.get("customer_id") as string;
  const kind = formData.get("transaction_kind") as string;
  const vehicleId = (formData.get("vehicle_id") as string) || null;
  const offeredAmount = (formData.get("offered_amount") as string) || null;

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      customer_id: customerId,
      transaction_kind: kind,
      vehicle_id: vehicleId ?? null,
      current_state: "pending",
      created_by: user.user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (kind === "sell" && offeredAmount) {
    await supabase.from("sell_details").insert({
      transaction_id: transaction.id,
      offered_amount: Number.parseFloat(offeredAmount),
    });
  }

  await supabase.from("transaction_status_history").insert({
    transaction_id: transaction.id,
    from_state: "pending",
    to_state: "pending",
    actor_id: user.user.id,
    reason: `Walk-in ${kind} transaction created`,
  });

  revalidatePath("/dashboard/transactions");
  return { success: true, id: transaction.id };
}

function validateFieldCaseSchedule(raw: string): string | null {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function createFieldCase(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  const CREATORS: Record<string, string[]> = {
    acquisition: ["ceo", "confidential_informant", "sales_manager"],
    delivery: ["ceo", "confidential_informant", "sales_manager"],
    recovery: ["ceo", "head_accountant"],
    sourcing: ["ceo", "sales_manager"],
    buyer_meetup: ["ceo", "sales_manager"],
  };

  const caseKind = formData.get("case_kind") as string;
  const allowed = CREATORS[caseKind];
  if (!role || !allowed?.includes(role)) {
    return { error: `Not authorized to create ${caseKind ?? ""} field cases` };
  }

  const parsed = fieldCaseCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid field case." };
  }

  const transactionId = parsed.data.transaction_id || null;
  const vehicleId = parsed.data.vehicle_id || null;
  const informantId = parsed.data.assigned_confidential_informant || null;
  const mechanicId = parsed.data.mechanic_id || null;
  const rawSchedule = parsed.data.schedule || null;
  const schedule = rawSchedule ? validateFieldCaseSchedule(rawSchedule) : null;
  if (rawSchedule && !schedule) {
    return { error: "Schedule must be a valid date and time." };
  }
  const location = parsed.data.location || null;
  const notes = parsed.data.notes || null;

  const { data: fieldCase, error } = await supabase
    .from("field_cases")
    .insert({
      transaction_id: transactionId,
      vehicle_id: vehicleId,
      case_kind: parsed.data.case_kind,
      assigned_confidential_informant: informantId,
      mechanic_id: mechanicId,
      schedule,
      location,
      state: "assigned",
      notes,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await logAuditEvent({
    actorId: user.user.id,
    action: `field_case_created_${parsed.data.case_kind}`,
    recordKind: "field_cases",
    recordId: fieldCase.id,
    summary: `${parsed.data.case_kind} field case created for transaction ${transactionId ?? vehicleId ?? ""}`,
  });

  revalidatePath("/dashboard/field-cases");
  revalidatePath("/dashboard/transactions");
  return { success: true, id: fieldCase.id };
}

export async function assignMechanic(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  // Task 32: mechanic assignment is owned by the Confidential Informant; the
  // CEO keeps an override. Sales Manager can no longer assign mechanics.
  if (!role || !["confidential_informant", "ceo"].includes(role)) {
    return { error: "Not authorized to assign mechanics" };
  }

  const fieldCaseId = formData.get("field_case_id") as string;
  const mechanicId = formData.get("mechanic_id") as string;

  if (!fieldCaseId || !mechanicId) return { error: "Field case and mechanic are required." };

  // user_roles is protected from the exposed API schemas. This RPC keeps the
  // role lookup server-side while enforcing the caller-role guard in SQL too.
  const { data: isActiveMechanic, error: mechanicError } = await supabase.rpc("is_active_mechanic", {
    p_account_id: mechanicId,
  });
  if (mechanicError || !isActiveMechanic) return { error: "The selected user is not an active mechanic." };

  const { error } = await supabase.from("field_cases").update({ mechanic_id: mechanicId }).eq("id", fieldCaseId);
  if (error) return { error: error.message };

  await logAuditEvent({
    actorId: user.user.id,
    action: "mechanic_assigned",
    recordKind: "field_cases",
    recordId: fieldCaseId,
    summary: `Mechanic ${mechanicId} assigned to field case ${fieldCaseId}`,
  });

  revalidatePath("/dashboard/field-cases");
  return { success: true };
}

export async function instructRepossession(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "head_accountant") {
    return { error: "Only the Head Accountant can instruct repossession." };
  }

  const transactionId = formData.get("transaction_id") as string;
  const informantId = formData.get("informant_id") as string;
  const reason = (formData.get("reason") as string) || null;

  if (!transactionId || !informantId) return { error: "Transaction and informant are required." };

  const { data: tx } = await supabase.from("transactions").select("id").eq("id", transactionId).maybeSingle();
  if (!tx) return { error: "Transaction not found." };

  const { data: account } = await supabase
    .from("installment_accounts")
    .select("id")
    .eq("purchase_transaction_id", transactionId)
    .maybeSingle();
  if (!account) return { error: "No installment account exists for this transaction." };

  const { data: overdue } = await supabase
    .from("installments")
    .select("id")
    .eq("account_id", account.id)
    .in("state", ["due", "overdue"])
    .order("due_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!overdue) return { error: "No due or overdue installments found for this transaction." };

  const { data: fieldCase, error } = await supabase
    .from("field_cases")
    .insert({
      transaction_id: transactionId,
      case_kind: "recovery",
      assigned_confidential_informant: informantId,
      state: "assigned",
      notes: reason ?? `Repossession instructed for transaction ${transactionId}`,
    })
    .select()
    .single();
  if (error) return { error: error.message };

  await supabase.from("collection_actions").insert({
    installment_id: overdue.id,
    action_kind: "recovery_instruction",
    actor_id: user.user.id,
    notes: reason ?? `Repossession instructed for transaction ${transactionId}`,
  });

  await logAuditEvent({
    actorId: user.user.id,
    action: "repossession_instructed",
    recordKind: "field_cases",
    recordId: fieldCase.id,
    summary: `Repossession instructed for transaction ${transactionId} to informant ${informantId}`,
  });

  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/field-cases");
  return { success: true, id: fieldCase.id };
}
