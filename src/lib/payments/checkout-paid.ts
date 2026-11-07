import { revalidatePath } from "next/cache";

import { notify } from "@/lib/notifications/notify";
import type { createAdminClient } from "@/lib/supabase/admin";
import { confirmInitialDownpaymentIfPaid } from "@/lib/transactions/financing-server";

type Admin = ReturnType<typeof createAdminClient>;

type PaidRow = {
  id: string;
  transaction_id: string;
  recorded_by: string;
  payment_kind: string | null;
  amount: number;
};

// Marks a PayMongo Checkout's unpaid rows paid: from the webhook, or from Pay when PayMongo already shows the
// session paid. Returns false when nothing was left unpaid, so a repeat changes nothing.
//
// T07 CR1: an installment is not self-verifying. PayMongo only proves the money arrived; the Sales Manager
// approves it and the Head Accountant verifies it. Downpayments and one-off payments keep the old rule.
export async function markCheckoutPaid(admin: Admin, checkoutId: string, paymentId: string | null): Promise<boolean> {
  const { data: rows } = await admin
    .from("payment_records")
    .select("id, transaction_id, recorded_by, payment_kind, amount")
    .eq("paymongo_checkout_id", checkoutId)
    .is("paid_at", null);
  const unpaid = (rows ?? []) as PaidRow[];
  if (unpaid.length === 0) return false;

  await admin
    .from("payment_records")
    .update({ paid_at: new Date().toISOString(), paymongo_payment_id: paymentId })
    .eq("paymongo_checkout_id", checkoutId)
    .is("paid_at", null);

  const installments = unpaid.filter((row) => row.payment_kind === "installment");
  const settled = unpaid.filter((row) => row.payment_kind !== "installment");

  // Verified by PayMongo itself, as before. Installments wait for the two staff approvals instead.
  if (settled.length > 0) {
    await admin
      .from("payment_records")
      .update({ verified_by: settled[0].recorded_by })
      .in(
        "id",
        settled.map((row) => row.id),
      );
  }

  const transactionId = unpaid[0].transaction_id;
  await confirmInitialDownpaymentIfPaid(admin, transactionId);

  if (settled.length > 0) {
    const total = settled.reduce((sum, row) => sum + Number(row.amount), 0);
    for (const role of ["head_accountant", "sales_manager"] as const) {
      await notify(
        admin,
        { role },
        {
          kind: "online_payment_paid",
          title: "Payment received on PayMongo",
          body: `The buyer paid ₱${total.toLocaleString()} through PayMongo. It is recorded as verified.`,
          transactionId,
        },
      );
    }
  }

  if (installments.length > 0) {
    const total = installments.reduce((sum, row) => sum + Number(row.amount), 0);
    const count = installments.length;
    await notify(
      admin,
      { role: "sales_manager" },
      {
        kind: "installment_awaiting_approval",
        title: "Online installment waiting for your approval",
        body: `The buyer paid ₱${total.toLocaleString()} for ${count} installment${count === 1 ? "" : "s"} through PayMongo. Approve it for the Head Accountant.`,
        transactionId,
      },
    );
    await notify(
      admin,
      { role: "head_accountant" },
      {
        kind: "installment_awaiting_approval",
        title: "Online installment waiting for Sales Manager approval",
        body: `The buyer paid ₱${total.toLocaleString()} through PayMongo. The Sales Manager must approve it before you verify.`,
        transactionId,
      },
    );
  }

  revalidatePath(`/my-transactions/${transactionId}`);
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  return true;
}
