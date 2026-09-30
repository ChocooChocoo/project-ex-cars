"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase, createServerSupabaseClient } from "@/lib/supabase/server";
import { MISSED_INSTALLMENTS_BEFORE_REPOSSESSION, missedInstallments, verifiedPaid } from "@/lib/transactions/buy-flow";

export interface NotificationRow {
  id: string;
  recipient_role: string | null;
  recipient_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  is_read: boolean;
  reference_table: string | null;
  reference_id: string | null;
  created_at: string;
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
        body: `An installment of ₱${(Number(installment.amount_due) / 100).toLocaleString()} for ${label} is due today (${installment.due_date}). Contact the buyer.`,
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

// Rows for the current role, plus rows addressed to this user. RLS limits recipient_id rows to
// recipient_id = auth.uid(), so "recipient_id not null" never reaches another user's row.
// The role is interpolated into a PostgREST filter, so only a plain role name is accepted.
function roleOrOwnFilter(role: string): string {
  const safeRole = /^[a-z_]+$/.test(role) ? role : "__none__";
  return `recipient_role.eq.${safeRole},recipient_id.not.is.null`;
}

// Awaited during Server Component renders (the staff/customer/supplier layouts), so it must
// use the read-only client and never write cookies.
export async function getNotifications(role: string): Promise<NotificationRow[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .or(roleOrOwnFilter(role))
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as NotificationRow[];
}

// Also awaited during Server Component renders, same constraint as getNotifications.
export async function getUnreadNotificationCount(role: string): Promise<number> {
  const supabase = await createServerSupabase();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .or(roleOrOwnFilter(role))
    .eq("is_read", false);
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const userRole = (roles as { account_id: string; role: string }[] | undefined)?.find(
    (r) => r.account_id === user.id,
  )?.role;
  if (!userRole) return { error: "No role assigned." };

  const { data: notification } = await supabase
    .from("notifications")
    .select("recipient_role, recipient_id")
    .eq("id", notificationId)
    .maybeSingle();
  if (!notification) return { error: "Notification not found." };
  if (notification.recipient_role !== userRole && notification.recipient_id !== user.id) {
    return { error: "Not authorized" };
  }

  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const userRole = (roles as { account_id: string; role: string }[] | undefined)?.find(
    (r) => r.account_id === user.id,
  )?.role;
  if (!userRole) return { error: "No role assigned." };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .or(`recipient_role.eq.${userRole},recipient_id.eq.${user.id}`)
    .eq("is_read", false);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}
