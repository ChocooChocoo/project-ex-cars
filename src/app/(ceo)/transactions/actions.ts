"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { logAuditEvent } from "@/lib/auth/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateInstallmentSchedule } from "@/lib/transactions/installments";
import type { TransactionState } from "@/lib/transactions/state-machine";
import { canTransition } from "@/lib/transactions/state-machine";
import { reviewSellSchema } from "@/lib/validation/transactions";

export async function transitionTransaction(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role) return { error: "No role assigned" };

  const id = formData.get("id") as string;
  const toState = formData.get("to_state") as TransactionState;
  const reason = (formData.get("reason") as string) || null;

  const { data: tx } = await supabase
    .from("transactions")
    .select("current_state, transaction_kind, vehicle_id")
    .eq("id", id)
    .single();

  if (!tx) return { error: "Transaction not found" };

  const fromState = tx.current_state as TransactionState;

  if (!canTransition(fromState, toState, role)) {
    return { error: "This action is not allowed for your role." };
  }

  // Use admin client for state transitions (bypass RLS for role-gated logic).
  const admin = await createAdminClient();

  const { error } = await admin
    .from("transactions")
    .update({
      current_state: toState,
      completed_at: ["completed", "cancelled", "rejected"].includes(toState) ? new Date().toISOString() : null,
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

  // Auto-set vehicle to sold when buy is completed.
  if (toState === "completed" && tx.transaction_kind === "buy" && tx.vehicle_id) {
    await admin.from("vehicles").update({ listing_state: "sold" }).eq("id", tx.vehicle_id);
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

export async function recordPayment(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const transactionId = formData.get("transaction_id") as string;
  const installmentId = (formData.get("installment_id") as string) || null;
  const amount = formData.get("amount") as string;
  const method = formData.get("method") as string;
  const externalRef = (formData.get("external_reference") as string) || null;
  const settlementDate = formData.get("settlement_date") as string;

  const { error } = await supabase.from("payment_records").insert({
    transaction_id: transactionId,
    installment_id: installmentId ?? null,
    amount: Number.parseFloat(amount),
    method,
    external_reference: externalRef,
    recorded_by: user.user.id,
    settlement_date: settlementDate,
  });

  if (error) return { error: error.message };

  // Update installment state if linked.
  if (installmentId) {
    await supabase.from("installments").update({ state: "paid", payment_date: settlementDate }).eq("id", installmentId);
  }

  await logAuditEvent({
    actorId: user.user.id,
    action: "payment_recorded",
    recordKind: "payment_records",
    recordId: transactionId,
    summary: `Payment of ₱${amount} recorded for transaction ${transactionId}`,
  });

  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/transactions/payments");
  return { success: true };
}

export async function verifyPayment(paymentId: string) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { error } = await supabase.from("payment_records").update({ verified_by: user.user.id }).eq("id", paymentId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/transactions/payments");
  return { success: true };
}

export async function createPaymentTerms(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const purchaseTransactionId = formData.get("purchase_transaction_id") as string;

  const { error } = await supabase.from("payment_terms").insert({
    purchase_transaction_id: purchaseTransactionId,
    arrangement_description: formData.get("arrangement_description") as string,
    total_amount: Number.parseFloat(formData.get("total_amount") as string),
    down_payment: Number.parseFloat(formData.get("down_payment") as string) || 0,
    number_of_payments: Number.parseInt(formData.get("number_of_payments") as string, 10),
    payment_frequency: formData.get("payment_frequency") as string,
    first_due_date: formData.get("first_due_date") as string,
    agreed_by: user.user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/transactions/${purchaseTransactionId}`);
  return { success: true };
}

export async function approvePaymentTerms(termsId: string) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

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

  const userResult = await (await createServerSupabase()).auth.getUser();
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
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const transactionId = formData.get("transaction_id") as string;
  const documentKind = formData.get("document_kind") as string;
  const file = formData.get("file") as File | null;

  let storagePath: string | null = null;

  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop() ?? "bin";
    storagePath = `${transactionId}/${documentKind}-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("transaction-documents").upload(storagePath, file);
    if (uploadError) return { error: uploadError.message };
  }

  const { error } = await supabase.from("transaction_documents").insert({
    transaction_id: transactionId,
    document_kind: documentKind,
    storage_path: storagePath,
    uploader_id: user.user.id,
    verification_state: "verified",
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/transactions/paperwork");
  return { success: true };
}

export async function reviewSellTransaction(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role) return { error: "No role assigned" };

  const parsed = reviewSellSchema.parse(Object.fromEntries(formData));

  const { data: tx } = await supabase
    .from("transactions")
    .select("current_state")
    .eq("id", parsed.transaction_id)
    .single();

  if (!tx) return { error: "Transaction not found" };

  const fromState = tx.current_state as TransactionState;
  const newState = parsed.decision === "accepted" ? "approved" : "rejected";

  if (!canTransition(fromState, newState as TransactionState, role)) {
    return { error: "This action is not allowed for your role." };
  }

  const { error } = await supabase
    .from("sell_details")
    .update({
      valuation_amount: parsed.valuation_amount,
      decision: parsed.decision,
      review_notes: parsed.review_notes ?? null,
      decision_maker_id: user.user.id,
      decision_date: new Date().toISOString(),
    })
    .eq("transaction_id", parsed.transaction_id);

  if (error) return { error: error.message };

  await supabase.from("transactions").update({ current_state: newState }).eq("id", parsed.transaction_id);

  await supabase.from("transaction_status_history").insert({
    transaction_id: parsed.transaction_id,
    from_state: fromState,
    to_state: newState,
    actor_id: user.user.id,
    reason: `Sell review: ${parsed.decision}. ${parsed.review_notes ?? ""}`,
  });

  await logAuditEvent({
    actorId: user.user.id,
    action: parsed.decision === "accepted" ? "sell_accepted" : "sell_rejected",
    recordKind: "transactions",
    recordId: parsed.transaction_id,
    summary: `Sell transaction ${parsed.transaction_id} ${parsed.decision}`,
  });

  revalidatePath(`/dashboard/transactions/${parsed.transaction_id}`);
  revalidatePath("/dashboard/transactions");
  return { success: true };
}

export async function assignInformant(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

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
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

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
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

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
