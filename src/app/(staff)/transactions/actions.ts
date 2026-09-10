"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { logAuditEvent } from "@/lib/auth/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateInstallmentSchedule } from "@/lib/transactions/installments";
import type { TransactionState } from "@/lib/transactions/state-machine";
import { canTransition } from "@/lib/transactions/state-machine";
import { fieldCaseCreateSchema } from "@/lib/validation/phase6";
import {
  paymentRecordSchema,
  paymentTermsSchema,
  reviewSellSchema,
  transitionSchema,
} from "@/lib/validation/transactions";

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

  // Task 32: HA verification precedes CEO approval. Two verified valid IDs +
  // proof of billing are required before a purchase is approved (not only at
  // completion), so the CEO cannot approve an unverified transaction (G16).
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
          "Two verified valid IDs and a verified proof of billing are required before approval. Ask the Head Accountant to verify the documents first.",
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
  }

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
  if (role !== "head_accountant") {
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

export async function reviewSellTransaction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role) return { error: "No role assigned" };

  const parsed = reviewSellSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sell review." };
  }

  const { data: tx } = await supabase
    .from("transactions")
    .select("current_state")
    .eq("id", parsed.data.transaction_id)
    .single();

  if (!tx) return { error: "Transaction not found" };

  const fromState = tx.current_state as TransactionState;
  const newState = parsed.data.decision === "accepted" ? "approved" : "rejected";

  if (!canTransition(fromState, newState as TransactionState, role)) {
    return { error: "This action is not allowed for your role." };
  }

  const admin = await createAdminClient();

  const { error } = await admin
    .from("sell_details")
    .update({
      valuation_amount: parsed.data.valuation_amount,
      decision: parsed.data.decision,
      review_notes: parsed.data.review_notes ?? null,
      decision_maker_id: user.user.id,
      decision_date: new Date().toISOString(),
    })
    .eq("transaction_id", parsed.data.transaction_id);

  if (error) return { error: error.message };

  await admin
    .from("transactions")
    .update({
      current_state: newState,
      completed_at: newState === "rejected" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.transaction_id);

  await admin.from("transaction_status_history").insert({
    transaction_id: parsed.data.transaction_id,
    from_state: fromState,
    to_state: newState,
    actor_id: user.user.id,
    reason: `Sell review: ${parsed.data.decision}. ${parsed.data.review_notes ?? ""}`,
  });

  await logAuditEvent({
    actorId: user.user.id,
    action: parsed.data.decision === "accepted" ? "sell_accepted" : "sell_rejected",
    recordKind: "transactions",
    recordId: parsed.data.transaction_id,
    summary: `Sell transaction ${parsed.data.transaction_id} ${parsed.data.decision}`,
  });

  revalidatePath(`/dashboard/transactions/${parsed.data.transaction_id}`);
  revalidatePath("/dashboard/transactions");
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
