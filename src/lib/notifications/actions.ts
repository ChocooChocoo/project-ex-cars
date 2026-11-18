"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { MISSED_INSTALLMENTS_BEFORE_REPOSSESSION, missedInstallments, verifiedPaid } from "@/lib/transactions/buy-flow";

export type { NotificationRow } from "./with-hrefs";

// amount_due is NUMERIC pesos, not cents.
function installmentDueBody(amount: number, label: string, dueDate: string, today: string): string {
  const pesos = amount.toLocaleString("en-PH", { maximumFractionDigits: 2 });
  const when = dueDate === today ? `is due today (${dueDate})` : `was due on ${dueDate}`;
  return `An installment of ₱${pesos} for ${label} ${when}. Contact the buyer.`;
}

/**
 * Scans installments that are due or overdue (not paid/waived) and creates an
 * unread notification for the Account Manager role, once per installment.
 * Called from the dashboard so due dates surface without a cron worker.
 */
export async function checkAndNotifyDueInstallments(): Promise<void> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  await flagMissedInstallments(admin, today);

  const { data: installments } = await admin
    .from("installments")
    .select(
      "id, due_date, amount_due, account_id, installment_accounts!inner(purchase_transaction_id, transactions!inner(id, vehicles!inner(make, model, year)))",
    )
    .lte("due_date", today)
    .not("state", "in", "('paid','waived')");

  if (!installments || installments.length === 0) return;

  const { data: existing } = await admin
    .from("notifications")
    .select("reference_id")
    .eq("reference_table", "installments")
    .eq("kind", "installment_due");

  const existingIds = new Set((existing ?? []).map((n) => n.reference_id));
  const toInsert = installments
    .filter((i) => !existingIds.has(i.id))
    .map((installment) => {
      const account = installment.installment_accounts as unknown as {
        purchase_transaction_id: string;
        transactions: { id: string; vehicles: { make: string; model: string; year: number } | null };
      } | null;
      const vehicle = account?.transactions?.vehicles;
      const label = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "a vehicle";
      return {
        recipient_role: "account_manager",
        kind: "installment_due",
        title: "Installment due",
        body: installmentDueBody(Number(installment.amount_due), label, installment.due_date, today),
        reference_table: "installments",
        reference_id: installment.id,
      };
    });

  if (toInsert.length > 0) {
    await admin.from("notifications").insert(toInsert);
  }
}

/**
 * Review windows that lapsed without a decision become "Overdue — Awaiting Action". Nothing is
 * cancelled and a locked visit slot stays locked. Sell offers notify the Marketing Specialist and
 * the CEO; buyer requests notify the Sales Manager. Once per lapsed window.
 * Called from the dashboard and the transaction list so it runs without a cron worker.
 */
export async function checkAndNotifyOverdueReviews(): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  await notifyMissedDownpayments(admin, now);

  const { data: overdue } = await admin
    .from("transactions")
    .select("id, transaction_kind, review_due_at")
    .lt("review_due_at", now)
    .not("current_state", "in", "('rejected','completed','cancelled')");
  if (!overdue || overdue.length === 0) return;

  const { data: existing } = await admin
    .from("notifications")
    .select("reference_id, created_at")
    .eq("kind", "review_overdue")
    .in(
      "reference_id",
      overdue.map((tx) => tx.id),
    );

  const toInsert = overdue
    // A notice created after this window's due date already covers it.
    .filter((tx) => !(existing ?? []).some((n) => n.reference_id === tx.id && n.created_at >= tx.review_due_at))
    .flatMap((tx) =>
      (tx.transaction_kind === "sell" ? ["marketing_specialist", "ceo"] : ["sales_manager"]).map((role) => ({
        recipient_role: role,
        kind: "review_overdue",
        title: "Overdue — Awaiting Action",
        body: `A ${tx.transaction_kind} transaction passed its 7-day review window without a decision. It stays open until processed.`,
        reference_table: "transactions",
        reference_id: tx.id,
      })),
    );

  if (toInsert.length > 0) {
    await admin.from("notifications").insert(toInsert);
  }
}

// §6 step 24: unpaid installments past their due date become overdue and flag the account. The Head
// Accountant hears once when an account is flagged and once when it reaches the repossession threshold.
async function flagMissedInstallments(admin: ReturnType<typeof createAdminClient>, today: string): Promise<void> {
  await admin.from("installments").update({ state: "overdue" }).lt("due_date", today).in("state", ["upcoming", "due"]);
  await admin.from("installments").update({ state: "due" }).eq("due_date", today).eq("state", "upcoming");

  const { data: accounts } = await admin
    .from("installment_accounts")
    .select("id, flagged_at, purchase_transaction_id, installments(state, due_date)")
    .eq("state", "active");
  for (const account of accounts ?? []) {
    const missed = missedInstallments(account.installments ?? [], new Date(`${today}T12:00:00Z`));
    if (missed === 0) continue;
    if (!account.flagged_at) {
      await admin.from("installment_accounts").update({ flagged_at: new Date().toISOString() }).eq("id", account.id);
      await admin.from("notifications").insert({
        recipient_role: "head_accountant",
        kind: "financing_missed_payment",
        title: "Financing account flagged",
        body: "A buyer missed an installment. The account is flagged; follow up on the payment.",
        reference_table: "transactions",
        reference_id: account.purchase_transaction_id,
      });
    }
    if (missed >= MISSED_INSTALLMENTS_BEFORE_REPOSSESSION) {
      const { count } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("kind", "financing_repossession_due")
        .eq("reference_id", account.purchase_transaction_id);
      if (!count) {
        await admin.from("notifications").insert({
          recipient_role: "head_accountant",
          kind: "financing_repossession_due",
          title: "Repossession may start",
          body: `${missed} installments are unpaid. Prepare the statement and instruct the repossession.`,
          reference_table: "transactions",
          reference_id: account.purchase_transaction_id,
        });
      }
    }
  }
}

// §4 step 5a: an approved delivery whose downpayment deadline passed unpaid. The Sales Manager is told
// once and cancels it from the transaction page; nothing is cancelled here.
async function notifyMissedDownpayments(admin: ReturnType<typeof createAdminClient>, now: string): Promise<void> {
  const { data: lapsed } = await admin
    .from("purchase_details")
    .select(
      "transaction_id, downpayment_amount, transactions!inner(current_state, payment_records(payment_kind, amount, verified_by))",
    )
    .lt("downpayment_due_at", now)
    .is("downpayment_forfeited_at", null)
    .eq("transactions.current_state", "approved");
  const unpaid = (lapsed ?? []).filter((row) => {
    const tx = row.transactions as unknown as {
      payment_records: { payment_kind: unknown; amount: unknown; verified_by: unknown }[] | null;
    };
    return verifiedPaid(tx.payment_records ?? [], "downpayment") < Number(row.downpayment_amount ?? 0);
  });
  if (unpaid.length === 0) return;

  const { data: existing } = await admin
    .from("notifications")
    .select("reference_id")
    .eq("kind", "downpayment_missed")
    .in(
      "reference_id",
      unpaid.map((row) => row.transaction_id),
    );
  const told = new Set((existing ?? []).map((n) => n.reference_id));
  const toInsert = unpaid
    .filter((row) => !told.has(row.transaction_id))
    .map((row) => ({
      recipient_role: "sales_manager",
      kind: "downpayment_missed",
      title: "Downpayment deadline passed",
      body: "A delivery buyer did not pay the downpayment in time. Cancel the request and promote the next On Hold buyer.",
      reference_table: "transactions",
      reference_id: row.transaction_id,
    }));
  if (toInsert.length > 0) await admin.from("notifications").insert(toInsert);
}
