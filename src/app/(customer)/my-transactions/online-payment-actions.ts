"use server";

// Phase 6 (payments): the PayMongo checkout actions stay on Supabase until the payment phase moves them to
// Laravel. They were split out of actions.ts unchanged when Phase 5 moved the rest of it to the browser.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { z } from "zod";

import { authorizeAction } from "@/lib/auth/action-guard";
import { markCheckoutPaid } from "@/lib/payments/checkout-paid";
import {
  type CheckoutBilling,
  createCheckoutSession,
  expireCheckoutSession,
  retrieveCheckoutSession,
} from "@/lib/payments/paymongo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { needsContract, onlinePaymentsDue, paymentAllowedBeforeSigning } from "@/lib/transactions/buy-flow";
import { nextUnpaidInstallment, unpaidInstallments } from "@/lib/transactions/financing-payments";

// T10: name, email and (when saved) phone for PayMongo's billing form, so the phone is never required.
async function buyerBilling(
  admin: ReturnType<typeof createAdminClient>,
  user: { id: string; email?: string | null },
): Promise<CheckoutBilling> {
  const { data: profile } = await admin.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
  return { name: profile?.full_name, email: user.email, phone: profile?.phone };
}

// The buyer pays what is due online (a delivery's fee and downpayment, or a financing downpayment) on a
// PayMongo Checkout Session for the exact amounts. The rows are recorded unpaid with the session id; the
// PayMongo webhook (src/app/api/paymongo/webhook/route.ts) marks them paid. Pay again reuses an open
// session, and an expired one is replaced.
export async function startOnlinePayment(
  formData: FormData,
): Promise<{ error: string } | { success: true; url: string }> {
  const authorization = await authorizeAction(["customer"]);
  if (!authorization.ok) return { error: authorization.message };
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) return { error: "Online payment is not set up yet." };

  const id = z.string().uuid().safeParse(formData.get("transaction_id"));
  if (!id.success) return { error: "Transaction not found." };

  const admin = createAdminClient();
  const { data: tx } = await admin
    .from("transactions")
    .select(
      "id, customer_id, current_state, flow_status, purchase_details(payment_method, arrangement_kind, delivery_fee, downpayment_amount, downpayment_due_at, final_price), payment_records(id, payment_kind, method, amount, paymongo_checkout_id, paid_at, verified_by, rejected_at), payment_terms(down_payment, state), sale_handovers(contract_state)",
    )
    .eq("id", id.data)
    .maybeSingle();
  if (!tx || tx.customer_id !== user.user.id || tx.current_state !== "approved") {
    return { error: "Transaction not found." };
  }
  const one = <T>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
  const details = one(tx.purchase_details);
  const due = onlinePaymentsDue(details, one(tx.payment_terms), tx.flow_status, {
    contract_state: one(tx.sale_handovers)?.contract_state,
    final_price: details?.final_price,
    payments: (tx.payment_records ?? []) as {
      payment_kind?: unknown;
      amount?: unknown;
      verified_by?: unknown;
      rejected_at?: unknown;
    }[],
  });
  if (due.length === 0) return { error: "Nothing is due online right now." };

  type Row = {
    payment_kind: unknown;
    method: unknown;
    paymongo_checkout_id: unknown;
    paid_at: unknown;
    verified_by: unknown;
    rejected_at: unknown;
  };
  let rows = (tx.payment_records ?? []) as Row[];
  const waiting = rows.find(
    (row) =>
      row.payment_kind !== "installment" &&
      row.method === "paymongo" &&
      row.paymongo_checkout_id &&
      !row.paid_at &&
      !row.verified_by &&
      !row.rejected_at,
  );
  if (waiting) {
    const checkoutId = String(waiting.paymongo_checkout_id);
    try {
      const session = await retrieveCheckoutSession(secretKey, checkoutId);
      // Already paid (the webhook may not have arrived yet): record it now instead of reopening it.
      if (session.paidPaymentId) {
        await markCheckoutPaid(admin, checkoutId, session.paidPaymentId);
        return { error: "Your payment is already received. Refresh the page to see it." };
      }
      if (session.status === "active") return { success: true, url: session.checkoutUrl };
    } catch {
      // An unreadable session is treated as expired and replaced below.
    }
    await admin
      .from("payment_records")
      .delete()
      .eq("paymongo_checkout_id", checkoutId)
      .neq("payment_kind", "installment")
      .is("paid_at", null)
      .is("verified_by", null)
      .is("rejected_at", null);
    rows = rows.filter((row) => row.paymongo_checkout_id !== checkoutId);
  }

  // A verified balance part does not block the next part (T10: large balances are paid in parts).
  const sent = new Set(
    rows.filter((row) => !(row.payment_kind === "balance" && row.verified_by)).map((row) => row.payment_kind),
  );
  const balanceParts = rows.filter((row) => row.payment_kind === "balance" && !row.rejected_at).length;
  const todo = due.filter((payment) => !sent.has(payment.kind));
  if (todo.length === 0) return { error: "Nothing is left to pay online." };
  if (
    needsContract(details) &&
    one(tx.sale_handovers)?.contract_state !== "signed" &&
    todo.some((payment) => !paymentAllowedBeforeSigning(details, payment.kind))
  ) {
    return { error: "Sign the contract before paying." };
  }

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  let session: { id: string; checkoutUrl: string };
  try {
    session = await createCheckoutSession(secretKey, {
      lineItems: todo.map((payment) => ({ name: payment.label, amount: payment.amount })),
      referenceNumber: tx.id,
      billing: await buyerBilling(admin, user.user),
      successUrl: `${origin}/my-transactions/${tx.id}?paid=1`,
      cancelUrl: `${origin}/my-transactions/${tx.id}?cancelled=1`,
    });
  } catch (error) {
    return { error: `PayMongo could not start the payment: ${(error as Error).message}` };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await admin.from("payment_records").insert(
    todo.map((payment) => ({
      transaction_id: tx.id,
      amount: payment.amount,
      method: "paymongo",
      payment_kind: payment.kind,
      part_no: payment.kind === "balance" ? balanceParts + 1 : 1,
      recorded_by: user.user.id,
      settlement_date: today,
      paymongo_checkout_id: session.id,
    })),
  );
  if (error) return { error: error.message };
  // §6 step 17: a claimed car's Initial Downpayment now waits for PayMongo's confirmation.
  if (todo.some((payment) => payment.kind === "downpayment") && tx.flow_status === "purchase_claim") {
    await admin.from("transactions").update({ flow_status: "initial_dp_awaiting_verification" }).eq("id", tx.id);
  }
  revalidatePath(`/my-transactions/${tx.id}`);
  revalidatePath(`/dashboard/transactions/${tx.id}`);
  return { success: true, url: session.checkoutUrl };
}

// T07 CR1: a bank transfer is paid through PayMongo. The session covers the next unpaid installment, or the
// ones the buyer ticks in Advanced Payment. The Sales Manager approves the result; the Head Accountant verifies it.
export async function startInstallmentCheckout(formData: FormData) {
  const authorization = await authorizeAction(["customer"]);
  if (!authorization.ok) return { error: authorization.message };
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) return { error: "Online payment is not set up yet." };

  const id = z.string().uuid().safeParse(formData.get("transaction_id"));
  if (!id.success) return { error: "Transaction not found." };

  const admin = createAdminClient();
  const { data: tx } = await admin
    .from("transactions")
    .select("id, customer_id, current_state")
    .eq("id", id.data)
    .maybeSingle();
  if (!tx || tx.customer_id !== user.user.id) return { error: "Transaction not found." };
  if (!["approved", "completed"].includes(tx.current_state)) {
    return { error: "This financing is not open for payments." };
  }

  const { data: account, error: accountError } = await admin
    .from("installment_accounts")
    .select("id, state, installments(id, account_id, state, due_date, amount_due, sequence_no)")
    .eq("purchase_transaction_id", tx.id)
    .maybeSingle();
  if (accountError) return { error: accountError.message };
  if (account?.state !== "active") return { error: "This financing account is not active." };

  const unpaid = unpaidInstallments(account.installments ?? []);
  let selected = unpaid.slice(0, 1);
  if (formData.get("advanced") === "yes") {
    const ids = z.array(z.string().uuid()).min(1).safeParse(formData.getAll("installment_ids"));
    if (!ids.success || new Set(ids.data).size !== ids.data.length) {
      return { error: "Select one or more unpaid installments." };
    }
    selected = unpaid.filter((installment) => ids.data.includes(installment.id));
    if (selected.length !== ids.data.length) return { error: "Select unpaid installments from this account only." };
  } else {
    const next = nextUnpaidInstallment(unpaid);
    selected = next ? [next] : [];
  }
  if (selected.length === 0) return { error: "No unpaid installments remain." };
  if (selected.some((installment) => installment.account_id !== account.id)) return { error: "Installment not found." };

  // An open PayMongo session is reused only for the same installments. A session for other installments
  // (an abandoned Advanced Payment) is expired and its unpaid rows removed, so it never sits in the history
  // or captures a later payment.
  const { data: liveRows, error: liveError } = await admin
    .from("payment_records")
    .select("installment_id, paymongo_checkout_id, paid_at")
    .eq("transaction_id", tx.id)
    .eq("payment_kind", "installment")
    .is("rejected_at", null);
  if (liveError) return { error: liveError.message };
  const openSessions = new Set(
    (liveRows ?? [])
      .filter((row) => row.paymongo_checkout_id && !row.paid_at)
      .map((row) => String(row.paymongo_checkout_id)),
  );
  const wanted = selected
    .map((installment) => String(installment.id))
    .sort()
    .join(",");
  for (const checkoutId of openSessions) {
    const covers = (liveRows ?? [])
      .filter((row) => row.paymongo_checkout_id === checkoutId)
      .map((row) => String(row.installment_id))
      .sort()
      .join(",");
    try {
      const session = await retrieveCheckoutSession(secretKey, checkoutId);
      if (session.paidPaymentId) {
        await markCheckoutPaid(admin, checkoutId, session.paidPaymentId);
        return { error: "Your payment is already received. Refresh the page to see it." };
      }
      if (session.status === "active" && covers === wanted) return { success: true, url: session.checkoutUrl };
      if (session.status === "active") await expireCheckoutSession(secretKey, checkoutId);
    } catch {
      // An unreadable session is treated as expired and replaced below.
    }
    await admin
      .from("payment_records")
      .delete()
      .eq("paymongo_checkout_id", checkoutId)
      .is("paid_at", null)
      .is("verified_by", null)
      .is("rejected_at", null);
  }

  const { data: existing, error: existingError } = await admin
    .from("payment_records")
    .select("installment_id, rejected_at")
    .eq("transaction_id", tx.id)
    .in(
      "installment_id",
      selected.map((installment) => installment.id),
    )
    .is("rejected_at", null);
  if (existingError) return { error: existingError.message };
  if ((existing ?? []).some((payment) => !payment.rejected_at)) {
    return { error: "A payment for a selected installment is already submitted. Wait for the review." };
  }

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  let session: { id: string; checkoutUrl: string };
  try {
    session = await createCheckoutSession(secretKey, {
      lineItems: selected.map((installment) => ({
        name: `Installment ${String(installment.sequence_no)} (due ${String(installment.due_date)})`,
        amount: Number(installment.amount_due),
      })),
      referenceNumber: tx.id,
      billing: await buyerBilling(admin, user.user),
      successUrl: `${origin}/my-transactions/${tx.id}?paid=1`,
      cancelUrl: `${origin}/my-transactions/${tx.id}?cancelled=1`,
    });
  } catch (error) {
    return { error: `PayMongo could not start the payment: ${(error as Error).message}` };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await admin.from("payment_records").insert(
    selected.map((installment) => ({
      transaction_id: tx.id,
      installment_id: installment.id,
      amount: installment.amount_due,
      method: "paymongo",
      payment_kind: "installment",
      recorded_by: user.user.id,
      submitted_by: user.user.id,
      settlement_date: today,
      paymongo_checkout_id: session.id,
    })),
  );
  if (error) {
    return {
      error: error.code === "23505" ? "A payment for this installment is already submitted." : error.message,
    };
  }

  revalidatePath(`/my-transactions/${tx.id}`);
  revalidatePath(`/dashboard/transactions/${tx.id}`);
  return { success: true, url: session.checkoutUrl };
}
