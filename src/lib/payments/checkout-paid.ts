import { revalidatePath } from "next/cache";

import { notify } from "@/lib/notifications/notify";
import type { createAdminClient } from "@/lib/supabase/admin";
import { confirmInitialDownpaymentIfPaid } from "@/lib/transactions/financing-server";

type Admin = ReturnType<typeof createAdminClient>;

// Marks a PayMongo Checkout's unpaid rows paid: from the webhook, or from Pay when PayMongo already shows the
// session paid. Returns false when nothing was left unpaid, so a repeat changes nothing.
export async function markCheckoutPaid(admin: Admin, checkoutId: string, paymentId: string | null): Promise<boolean> {
  const { data: rows } = await admin
    .from("payment_records")
    .select("id, transaction_id, recorded_by, payment_kind, amount")
    .eq("paymongo_checkout_id", checkoutId)
    .is("paid_at", null);
  const unpaid = (rows ?? []) as { transaction_id: string; recorded_by: string; amount: number }[];
  if (unpaid.length === 0) return false;

  // ponytail: verified_by takes the buyer's id so every existing "verified" check counts the payment;
  // paymongo_payment_id marks it as confirmed by PayMongo. Add a verified_via column if audits need more.
  await admin
    .from("payment_records")
    .update({
      paid_at: new Date().toISOString(),
      paymongo_payment_id: paymentId,
      verified_by: unpaid[0].recorded_by,
    })
    .eq("paymongo_checkout_id", checkoutId)
    .is("paid_at", null);

  const transactionId = unpaid[0].transaction_id;
  await confirmInitialDownpaymentIfPaid(admin, transactionId);
  const total = unpaid.reduce((sum, row) => sum + Number(row.amount), 0);
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
  revalidatePath(`/my-transactions/${transactionId}`);
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  return true;
}
