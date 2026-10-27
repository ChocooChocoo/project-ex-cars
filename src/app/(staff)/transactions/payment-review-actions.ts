"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { logAuditEvent } from "@/lib/auth/audit";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { installmentStateFor } from "@/lib/transactions/buy-flow";
import { formatCurrency } from "@/lib/utils";

// Same roles as verifyPayment.
const PAYMENT_REVIEWERS = ["ceo", "head_accountant"];

// T03 HA3: a payment waiting for verification can be rejected with a reason. It stays on record as rejected,
// stops counting toward what was paid, reopens the installment it had closed, and the buyer is told why.
export async function rejectPayment(paymentId: string, reason: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !PAYMENT_REVIEWERS.includes(role)) return { error: "Not authorized" };

  const text = reason.trim();
  if (!text) return { error: "Give a reason for rejecting." };
  if (text.length > 1000) return { error: "Keep the reason under 1000 characters." };

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payment_records")
    .select(
      "id, transaction_id, installment_id, payment_kind, amount, verified_by, rejected_at, transactions(customer_id)",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { error: "Payment not found." };
  if (payment.verified_by || payment.rejected_at) {
    return { error: "Only a payment waiting for verification can be rejected." };
  }

  // The verified_by / rejected_at filters keep a concurrent Verify from being overwritten.
  const { error } = await admin
    .from("payment_records")
    .update({ rejected_by: user.user.id, rejected_at: new Date().toISOString(), rejection_reason: text })
    .eq("id", paymentId)
    .is("verified_by", null)
    .is("rejected_at", null);
  if (error) return { error: error.message };

  if (payment.installment_id) {
    const { data: installment } = await admin
      .from("installments")
      .select("due_date")
      .eq("id", payment.installment_id)
      .maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    await admin
      .from("installments")
      .update({ state: installmentStateFor(String(installment?.due_date ?? today), today), payment_date: null })
      .eq("id", payment.installment_id);
  }

  const customerId = (payment.transactions as unknown as { customer_id: string } | null)?.customer_id;
  if (customerId) {
    await notify(
      admin,
      { userId: customerId },
      {
        kind: "payment_rejected",
        title: "A payment was not accepted",
        body: `Your payment of ${formatCurrency(Number(payment.amount))} was not accepted: ${text}`,
        transactionId: payment.transaction_id as string,
      },
    );
  }

  await logAuditEvent({
    actorId: user.user.id,
    action: "payment_rejected",
    recordKind: "payment_records",
    recordId: paymentId,
    summary: `Payment of PHP ${payment.amount} rejected: ${text}`,
  });

  revalidatePath(`/dashboard/transactions/${payment.transaction_id}`);
  return { success: true };
}
