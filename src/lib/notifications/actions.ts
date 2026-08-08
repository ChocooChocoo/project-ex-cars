"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export interface NotificationRow {
  id: string;
  recipient_role: string;
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

export async function getNotifications(role: string): Promise<NotificationRow[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_role", role)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as NotificationRow[];
}

export async function getUnreadNotificationCount(role: string): Promise<number> {
  const supabase = await createServerSupabase();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_role", role)
    .eq("is_read", false);
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createServerSupabase();
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
    .select("recipient_role")
    .eq("id", notificationId)
    .maybeSingle();
  if (!notification) return { error: "Notification not found." };
  if (notification.recipient_role !== userRole) return { error: "Not authorized" };

  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}
