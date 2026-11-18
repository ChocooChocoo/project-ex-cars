"use server";

// Phase 6 (payments): recording, verifying and waiving payments stay on Supabase until the payment phase
// moves them to Laravel. They were split out of actions.ts unchanged when Phase 5 moved the rest to the browser.

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { getCurrentRole } from "@/lib/auth/server-session";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { needsContract, nextDuePayment, paymentAllowedBeforeSigning } from "@/lib/transactions/buy-flow";
import { applyDeliveryReschedule, notifyInformantIfPaidInFull } from "@/lib/transactions/buy-flow-server";
import { closeFinancingIfPaid, confirmInitialDownpaymentIfPaid } from "@/lib/transactions/financing-server";
import { paymentRecordSchema } from "@/lib/validation/transactions";

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

  // T05: the Head Accountant verifies the payment. The only row they still record is an installment,
  // written by the financing "Record payment" button.
  if (role === "head_accountant" && !installmentId) {
    return { error: "The Sales Manager records the payment. The Head Accountant verifies it." };
  }
  // T07 CR1: cash installments belong to the Sales Manager; the Head Accountant only verifies them.
  if (installmentId && !["sales_manager", "ceo"].includes(role)) {
    return { error: "The Sales Manager records the installment. The Head Accountant verifies it." };
  }

  let amount = parsed.data.amount;
  let method = parsed.data.method;
  let paymentKind: string | null = installmentId ? "installment" : parsed.data.payment_kind || null;

  // T07 CR1: an installment is always the recorded amount of that installment, paid in cash at GCE.
  // The client cannot pick the amount or send a bank transfer through this staff path.
  if (installmentId) {
    const { data: installment, error: installmentError } = await createAdminClient()
      .from("installments")
      .select("id, amount_due, account_id, installment_accounts!inner(purchase_transaction_id)")
      .eq("id", installmentId)
      .maybeSingle();
    if (installmentError) return { error: installmentError.message };
    if (!installment) return { error: "Installment not found." };
    const account = Array.isArray(installment.installment_accounts)
      ? installment.installment_accounts[0]
      : installment.installment_accounts;
    if (account?.purchase_transaction_id !== transactionId) return { error: "Installment not found." };
    amount = Number(installment.amount_due);
    method = "cash";
    paymentKind = "installment";
  }

  // Contract first: no money is recorded on a sale that needs a contract until the buyer has signed.
  // A delivery's fee and downpayment come before the day, and an installment only exists after signing.
  if (!installmentId) {
    const { data: sale } = await createAdminClient()
      .from("transactions")
      .select(
        "flow_status, purchase_details(payment_method, arrangement_kind, final_price, delivery_fee, downpayment_amount, downpayment_due_at), payment_records(payment_kind, amount, verified_by, rejected_at), sale_handovers(contract_state)",
      )
      .eq("id", transactionId)
      .maybeSingle();
    const details = (Array.isArray(sale?.purchase_details) ? sale.purchase_details[0] : sale?.purchase_details) ?? null;
    const handover = Array.isArray(sale?.sale_handovers) ? sale.sale_handovers[0] : sale?.sale_handovers;
    // T05: a CASH buy has one payment due at a time. The server works it out, so a typed amount or kind
    // cannot be spammed in, and a second submission of the same kind finds nothing left to record.
    if (details?.payment_method === "cash") {
      const due = nextDuePayment(details, sale?.payment_records ?? [], sale?.flow_status ?? null);
      if (!due) return { error: "Nothing is due on this purchase." };
      amount = due.amount;
      method = due.method;
      paymentKind = due.kind;
    }
    if (
      needsContract(details) &&
      handover?.contract_state !== "signed" &&
      !paymentAllowedBeforeSigning(details, paymentKind)
    ) {
      return { error: "The buyer must sign the contract before a payment is recorded." };
    }
  }

  // T03 HA2: an optional photo of the deposit slip or receipt, viewed by the Head Accountant before verifying.
  const proof = formData.get("proof");
  let proofPath: string | null = null;
  if (proof instanceof File && proof.size > 0) {
    if (!/^image\/(jpeg|png|webp)$/.test(proof.type)) return { error: "The payment photo must be a JPG, PNG or WebP." };
    const ext = proof.type.split("/")[1].replace("jpeg", "jpg");
    proofPath = `${transactionId}/payment-proof-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("transaction-documents").upload(proofPath, proof);
    if (uploadError) return { error: uploadError.message };
  }

  const { error } = await supabase.from("payment_records").insert({
    transaction_id: transactionId,
    installment_id: installmentId ?? null,
    amount,
    method,
    external_reference: parsed.data.external_reference || null,
    recorded_by: user.user.id,
    settlement_date: parsed.data.settlement_date,
    payment_kind: paymentKind,
    proof_path: proofPath,
  });

  if (error) {
    if (proofPath) await supabase.storage.from("transaction-documents").remove([proofPath]);
    // T05: the partial unique index refuses a second live row of the same payment kind.
    if (error.code === "23505") return { error: "This payment is already recorded." };
    return { error: error.message };
  }

  // §6 step 17: the Initial Downpayment of a claimed car now waits for the Head Accountant.
  if (paymentKind === "downpayment") {
    await createAdminClient()
      .from("transactions")
      .update({ flow_status: "initial_dp_awaiting_verification" })
      .eq("id", transactionId)
      .eq("flow_status", "purchase_claim");
  }

  // T11: every recorded row waits for the Head Accountant's confirmation, so they are told once. An online
  // installment is the exception: the Sales Manager approves it first, and that approval notifies them. The
  // payment schema refuses PayMongo here today, so the comparison is widened to keep the guard honest if the
  // channel is ever let through.
  if (!(paymentKind === "installment" && String(method) === "paymongo")) {
    await notify(
      createAdminClient(),
      { role: "head_accountant" },
      {
        kind: "installment_recorded",
        title: "Payment waiting for your confirmation",
        body: `₱${Number(amount).toLocaleString()} recorded for ${paymentKind?.replace(/_/g, " ") ?? "payment"}. Verify it to count the payment.`,
        transactionId,
      },
    );
  }

  await logAuditEvent({
    actorId: user.user.id,
    action: "payment_recorded",
    recordKind: "payment_records",
    recordId: transactionId,
    summary: `Payment of PHP ${amount} recorded for transaction ${transactionId}`,
  });

  revalidatePath(`/dashboard/transactions/${transactionId}`);
  return { success: true };
}

// T11: an advance payment settles several installments at once, in cash at GCE. The Sales Manager picks the
// installments; the server reads each amount, so a client amount is never trusted, and the Head Accountant
// confirms every row.
export async function recordAdvancePayment(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["sales_manager", "ceo"].includes(role)) {
    return { error: "The Sales Manager records the advance payment." };
  }

  const transactionId = z.string().uuid().safeParse(formData.get("transaction_id"));
  if (!transactionId.success) return { error: "Invalid request." };
  const installmentIds = [
    ...new Set(
      formData
        .getAll("installment_ids")
        .map((value) => String(value))
        .filter(Boolean),
    ),
  ];
  if (installmentIds.length === 0) return { error: "Pick at least one installment to pay in advance." };

  const admin = createAdminClient();
  const made: { amount: number }[] = [];
  for (const installmentId of installmentIds) {
    const parsedId = z.string().uuid().safeParse(installmentId);
    if (!parsedId.success) return { error: "Installment not found." };
    const { data: installment, error: readError } = await admin
      .from("installments")
      .select("id, amount_due, state, account_id, installment_accounts!inner(purchase_transaction_id)")
      .eq("id", parsedId.data)
      .maybeSingle();
    if (readError) return { error: readError.message };
    if (!installment) return { error: "Installment not found." };
    const account = Array.isArray(installment.installment_accounts)
      ? installment.installment_accounts[0]
      : installment.installment_accounts;
    if (account?.purchase_transaction_id !== transactionId.data) return { error: "Installment not found." };
    if (installment.state === "paid" || installment.state === "waived") {
      return { error: "This installment is already settled." };
    }

    const { error } = await admin.from("payment_records").insert({
      transaction_id: transactionId.data,
      installment_id: parsedId.data,
      amount: Number(installment.amount_due),
      method: "cash",
      recorded_by: user.user.id,
      settlement_date: new Date().toISOString().slice(0, 10),
      payment_kind: "installment",
      proof_path: null,
    });
    if (error) {
      if (error.code === "23505") return { error: "This installment is already recorded." };
      return { error: error.message };
    }
    made.push({ amount: Number(installment.amount_due) });
  }

  const total = made.reduce((sum, payment) => sum + payment.amount, 0);
  await notify(
    admin,
    { role: "head_accountant" },
    {
      kind: "installment_recorded",
      title: "Advance payment waiting for your confirmation",
      body: `The Sales Manager recorded ₱${total.toLocaleString()} for ${made.length} installment${made.length === 1 ? "" : "s"}. Confirm them.`,
      transactionId: transactionId.data,
    },
  );

  await logAuditEvent({
    actorId: user.user.id,
    action: "advance_payment_recorded",
    recordKind: "payment_records",
    recordId: transactionId.data,
    summary: `Advance payment of PHP ${total} recorded for ${made.length} installments`,
  });

  revalidatePath(`/dashboard/transactions/${transactionId.data}`);
  revalidatePath(`/my-transactions/${transactionId.data}`);
  return { success: true, recorded: made.length };
}

export async function verifyPayment(paymentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "head_accountant"].includes(role)) {
    return { error: "Not authorized" };
  }

  const { data: record, error: readError } = await supabase
    .from("payment_records")
    .select("id, method, payment_kind, amount, installment_id, approved_at, verified_by, rejected_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!record) return { error: "Payment not found." };
  if (record.rejected_at) return { error: "This payment was rejected." };
  if (record.verified_by) return { error: "This payment is already verified." };
  // T07 CR1: an online installment goes PayMongo → Sales Manager approval → Head Accountant verification.
  if (record.payment_kind === "installment" && record.method === "paymongo" && !record.approved_at) {
    return { error: "The Sales Manager must approve this online payment first." };
  }
  if (record.installment_id) {
    const { data: installment } = await supabase
      .from("installments")
      .select("amount_due")
      .eq("id", record.installment_id)
      .maybeSingle();
    if (!installment || Number(installment.amount_due) !== Number(record.amount)) {
      return { error: "The payment amount does not match the installment." };
    }
  }

  const { data: payment, error } = await supabase
    .from("payment_records")
    .update({ verified_by: user.user.id })
    .eq("id", paymentId)
    // T03 HA3: a rejected payment cannot be verified afterwards.
    .is("rejected_at", null)
    .is("verified_by", null)
    .select("transaction_id, installment_id, settlement_date, payment_kind, amount")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!payment) return { error: "This payment is already verified." };
  if (payment) {
    const admin = createAdminClient();
    if (payment.installment_id) {
      const { error: installmentError } = await admin
        .from("installments")
        .update({ state: "paid", payment_date: payment.settlement_date ?? new Date().toISOString().slice(0, 10) })
        .eq("id", payment.installment_id);
      if (installmentError) return { error: installmentError.message };
      await closeFinancingIfPaid(admin, payment.transaction_id);
      const { data: buyer } = await admin
        .from("transactions")
        .select("customer_id")
        .eq("id", payment.transaction_id)
        .maybeSingle();
      if (buyer?.customer_id) {
        await notify(
          admin,
          { userId: buyer.customer_id as string },
          {
            kind: "installment_verified",
            title: "Your installment payment is verified",
            body: "The Head Accountant verified your installment. It now counts toward your financing.",
            transactionId: payment.transaction_id,
          },
        );
      }
      await notify(
        admin,
        { role: "sales_manager" },
        {
          kind: "installment_verified",
          title: "Installment verified by the Head Accountant",
          body: "The buyer's installment now counts as paid.",
          transactionId: payment.transaction_id,
        },
      );
    }
    await confirmInitialDownpaymentIfPaid(admin, payment.transaction_id);
    await notifyInformantIfPaidInFull(admin, payment.transaction_id);
    // T10: a verified re-scheduling fee releases the buyer's new delivery time to the team.
    if (payment.payment_kind === "reschedule_fee") {
      const { data: pending } = await admin
        .from("purchase_details")
        .select("reschedule_pending_at, reschedule_pending_location")
        .eq("transaction_id", payment.transaction_id)
        .maybeSingle();
      if (pending?.reschedule_pending_at && pending.reschedule_pending_location) {
        const rescheduleError = await applyDeliveryReschedule(
          admin,
          { id: payment.transaction_id, current_state: "approved" },
          {
            schedule: pending.reschedule_pending_at,
            location: pending.reschedule_pending_location,
            fee: Number(payment.amount),
          },
          user.user.id,
        );
        if (rescheduleError) return { error: rescheduleError };
      }
    }
    revalidatePath(`/dashboard/transactions/${payment.transaction_id}`);
    revalidatePath(`/my-transactions/${payment.transaction_id}`);
  }

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

  const { data: installment, error } = await supabase
    .from("installments")
    .update({ state: "waived" })
    .eq("id", installmentId)
    .select("account_id")
    .maybeSingle();

  if (error) return { error: error.message };

  if (installment) {
    const admin = createAdminClient();
    const { data: account } = await admin
      .from("installment_accounts")
      .select("purchase_transaction_id")
      .eq("id", installment.account_id)
      .maybeSingle();
    if (account) {
      await closeFinancingIfPaid(admin, account.purchase_transaction_id);
      revalidatePath(`/my-transactions/${account.purchase_transaction_id}`);
      revalidatePath(`/dashboard/transactions/${account.purchase_transaction_id}`);
    }
  }

  await logAuditEvent({
    actorId: user.user.id,
    action: "installment_waived",
    recordKind: "installments",
    recordId: installmentId,
    summary: `Installment ${installmentId} waived`,
  });

  return { success: true };
}
