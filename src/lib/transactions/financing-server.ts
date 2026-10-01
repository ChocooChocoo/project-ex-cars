// Server-side building blocks for In-House Financing (§6). Not a "use server" module: these write with
// the service role and must only run behind a role-guarded action.

import { z } from "zod";

import { notify } from "@/lib/notifications/notify";
import type { createAdminClient } from "@/lib/supabase/admin";
import { financingFullyPaid, isFinancingRequest, verifiedPaid } from "@/lib/transactions/buy-flow";
import { generateInstallmentSchedule } from "@/lib/transactions/installments";

type Admin = ReturnType<typeof createAdminClient>;

export interface FinancingTerms {
  id: string;
  purchase_transaction_id: string;
  total_amount: number;
  down_payment: number;
  number_of_payments: number;
  payment_frequency: string;
  first_due_date: string;
  state: string;
}

// §6 step 19: opens the financing account and its installment schedule from the approved terms.
export async function openFinancingAccount(admin: Admin, terms: FinancingTerms): Promise<string | null> {
  const schedule = generateInstallmentSchedule({
    totalAmount: Number(terms.total_amount),
    downPayment: Number(terms.down_payment),
    numberOfPayments: Number(terms.number_of_payments),
    firstDueDate: new Date(terms.first_due_date),
    frequency: terms.payment_frequency as never,
  });

  const { data: account, error: accountError } = await admin
    .from("installment_accounts")
    .insert({
      purchase_transaction_id: terms.purchase_transaction_id,
      financed_total: terms.total_amount,
      down_payment: terms.down_payment,
      opening_balance: Number(terms.total_amount) - Number(terms.down_payment),
      start_date: terms.first_due_date,
    })
    .select("id")
    .single();
  if (accountError) return accountError.message;

  const { error: installmentError } = await admin.from("installments").insert(
    schedule.map((s) => ({
      account_id: account.id,
      sequence_no: s.sequenceNo,
      due_date: s.dueDate,
      amount_due: s.amountDue,
    })),
  );
  if (installmentError) return installmentError.message;

  const { error } = await admin.from("payment_terms").update({ state: "active" }).eq("id", terms.id);
  return error?.message ?? null;
}

// A financing request (In-House Financing with a GCE visit, meet-up or delivery) with its terms and payments.
export async function loadFinancing(admin: Admin, transactionId: unknown) {
  const id = z.string().uuid().safeParse(transactionId);
  if (!id.success) return null;
  const { data: tx } = await admin
    .from("transactions")
    .select(
      "id, customer_id, vehicle_id, current_state, flow_status, transaction_kind, purchase_details(payment_method, arrangement_kind), payment_records(payment_kind, amount, verified_by)",
    )
    .eq("id", id.data)
    .maybeSingle();
  if (tx?.transaction_kind !== "buy") return null;
  const details = Array.isArray(tx.purchase_details) ? tx.purchase_details[0] : tx.purchase_details;
  if (!isFinancingRequest(details ?? null)) return null;
  const { data: terms } = await admin
    .from("payment_terms")
    .select("*")
    .eq("purchase_transaction_id", tx.id)
    .maybeSingle();
  return { ...tx, terms: terms as (FinancingTerms & Record<string, unknown>) | null };
}

// §6 step 18: called after a payment is verified; confirms the Initial Downpayment once it is covered.
export async function confirmInitialDownpaymentIfPaid(admin: Admin, transactionId: string): Promise<void> {
  const tx = await loadFinancing(admin, transactionId);
  if (!tx?.terms || tx.flow_status !== "initial_dp_awaiting_verification") return;
  if (verifiedPaid(tx.payment_records ?? [], "downpayment") < Number(tx.terms.down_payment)) return;
  await admin.from("transactions").update({ flow_status: "initial_dp_confirmed" }).eq("id", tx.id);
  await notify(
    admin,
    { role: "head_accountant" },
    {
      kind: "initial_dp_confirmed",
      title: "Initial Downpayment confirmed",
      body: "Complete the financing agreement to open the account.",
      transactionId: tx.id,
    },
  );
}

// §6 step 25: once every installment is paid or waived, the account closes and the financing completes.
export async function closeFinancingIfPaid(admin: Admin, transactionId: string): Promise<void> {
  const { data: account } = await admin
    .from("installment_accounts")
    .select("id, state, installments(state, due_date)")
    .eq("purchase_transaction_id", transactionId)
    .maybeSingle();
  if (account?.state !== "active" || !financingFullyPaid(account.installments ?? [])) return;

  await admin
    .from("installment_accounts")
    .update({ state: "closed", closed_date: new Date().toISOString().slice(0, 10) })
    .eq("id", account.id);
  await admin.from("payment_terms").update({ state: "completed" }).eq("purchase_transaction_id", transactionId);
  const { data: tx } = await admin
    .from("transactions")
    .update({ flow_status: "financing_completed" })
    .eq("id", transactionId)
    .select("customer_id")
    .single();
  if (tx) {
    await notify(
      admin,
      { userId: tx.customer_id },
      {
        kind: "financing_completed",
        title: "Your financing is fully paid",
        body: "Every installment is paid. Your In-House Financing account is now closed.",
        transactionId,
      },
    );
  }
}
