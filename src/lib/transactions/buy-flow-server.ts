// Server-side building blocks for the buying flows. Not a "use server" module: these write with the
// service role and must only run behind a role- or ownership-checked action.

import { notify } from "@/lib/notifications/notify";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// §2: a rejected or cancelled request gives its locked visit slot back.
export async function releaseVisitSlots(admin: Admin, transactionId: string): Promise<void> {
  await admin
    .from("viewing_arrangements")
    .update({ confirmation_state: "cancelled" })
    .eq("purchase_transaction_id", transactionId)
    .in("confirmation_state", ["pending", "confirmed"]);
}

// §2 step 6, "Mark Sold to This Buyer": the car leaves the listings and every other open request
// for it ends, freeing their slots. Other buyers are told (Q13 default: yes).
export async function finalizeBuySale(
  admin: Admin,
  sale: { id: string; vehicle_id: string | null },
  actorId: string,
): Promise<void> {
  await admin.from("transactions").update({ flow_status: "sold", review_due_at: null }).eq("id", sale.id);
  await admin
    .from("viewing_arrangements")
    .update({ confirmation_state: "completed" })
    .eq("purchase_transaction_id", sale.id)
    .in("confirmation_state", ["pending", "confirmed"]);
  if (!sale.vehicle_id) return;

  await admin.from("vehicles").update({ listing_state: "sold" }).eq("id", sale.vehicle_id);

  const { data: competitors } = await admin
    .from("transactions")
    .select("id, customer_id, current_state")
    .eq("vehicle_id", sale.vehicle_id)
    .eq("transaction_kind", "buy")
    .neq("id", sale.id)
    .in("current_state", ["pending", "under_review", "approved"]);

  const now = new Date().toISOString();
  for (const other of competitors ?? []) {
    await admin
      .from("transactions")
      .update({ current_state: "cancelled", completed_at: now, flow_status: null, review_due_at: null })
      .eq("id", other.id);
    await admin.from("transaction_status_history").insert({
      transaction_id: other.id,
      from_state: other.current_state,
      to_state: "cancelled",
      actor_id: actorId,
      reason: "Vehicle sold to another buyer",
    });
    await releaseVisitSlots(admin, other.id);
    await notify(
      admin,
      { userId: other.customer_id },
      {
        kind: "vehicle_sold_elsewhere",
        title: "This car has been sold",
        body: "The car you requested was sold to another buyer, so your request has been closed.",
        transactionId: other.id,
      },
    );
  }
}
