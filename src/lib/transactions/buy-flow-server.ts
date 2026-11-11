// Server-side building blocks for the buying flows. Not a "use server" module: these write with the
// service role and must only run behind a role- or ownership-checked action.

import { notify } from "@/lib/notifications/notify";
import type { createAdminClient } from "@/lib/supabase/admin";
import { isDirectPayment, nextStanding, type Standing, verifiedTowardPrice } from "@/lib/transactions/buy-flow";

type Admin = ReturnType<typeof createAdminClient>;

// §2: a rejected or cancelled request gives its locked visit slot back.
export async function releaseVisitSlots(admin: Admin, transactionId: string): Promise<void> {
  await admin
    .from("viewing_arrangements")
    .update({ confirmation_state: "cancelled" })
    .eq("purchase_transaction_id", transactionId)
    .in("confirmation_state", ["pending", "confirmed"]);
}

// T10: a car held by a buyer (a financed Purchase Claim or an open financing account) leaves the showroom.
// Only an available car is reserved, so a sold or repairing car keeps its state.
export async function reserveVehicle(admin: Admin, vehicleId: string | null): Promise<void> {
  if (!vehicleId) return;
  await admin
    .from("vehicles")
    .update({ listing_state: "reserved" })
    .eq("id", vehicleId)
    .eq("listing_state", "available");
}

// The flow statuses in which a buyer holds the car reserved.
export const HOLDING_FLOW_STATUSES = [
  "purchase_claim",
  "initial_dp_awaiting_verification",
  "initial_dp_confirmed",
  "financing_active",
] as const;

// A cancelled or rejected buyer who held the car gives it back to the showroom.
export async function releaseVehicle(
  admin: Admin,
  sale: { vehicle_id: string | null; flow_status: string | null },
): Promise<void> {
  if (!sale.vehicle_id || !(HOLDING_FLOW_STATUSES as readonly string[]).includes(sale.flow_status ?? "")) return;
  await admin
    .from("vehicles")
    .update({ listing_state: "available" })
    .eq("id", sale.vehicle_id)
    .eq("listing_state", "reserved");
}

// T10: once a cash or Bank Transfer buyer's payment is verified in full, the Confidential Informant on the
// field case is told to finish the delivery and release the papers.
export async function notifyInformantIfPaidInFull(admin: Admin, transactionId: string): Promise<void> {
  const { data: tx } = await admin
    .from("transactions")
    .select(
      "purchase_details(payment_method, final_price), payment_records(payment_kind, amount, verified_by, rejected_at)",
    )
    .eq("id", transactionId)
    .maybeSingle();
  const details = Array.isArray(tx?.purchase_details) ? tx.purchase_details[0] : tx?.purchase_details;
  if (!details || !isDirectPayment(details)) return;
  if (verifiedTowardPrice(tx?.payment_records ?? []) < Number(details.final_price ?? 0)) return;
  const { data: cases } = await admin
    .from("field_cases")
    .select("assigned_confidential_informant")
    .eq("transaction_id", transactionId)
    .in("case_kind", ["delivery", "buyer_meetup"])
    .neq("state", "cancelled");
  for (const informant of new Set((cases ?? []).map((row) => row.assigned_confidential_informant).filter(Boolean))) {
    await notify(
      admin,
      { userId: informant as string },
      {
        kind: "buyer_paid_in_full",
        title: "Buyer's payment verified",
        body: "The Head Accountant verified the buyer's full payment. Mark the car delivered and release the papers.",
        transactionId,
      },
    );
  }
}

// T10: moves a delivery to its new time and address: a new arrangement, the field case, the purchase
// location, a history line, and the new schedule to the Sales Manager and the Confidential Informant.
export async function applyDeliveryReschedule(
  admin: Admin,
  sale: { id: string; current_state: string },
  change: { schedule: string; location: string; fee: number },
  actorId: string,
): Promise<string | null> {
  await admin
    .from("viewing_arrangements")
    .update({ confirmation_state: "cancelled" })
    .eq("purchase_transaction_id", sale.id)
    .eq("arrangement_kind", "delivery")
    .in("confirmation_state", ["pending", "confirmed"]);
  const { error } = await admin.from("viewing_arrangements").insert({
    purchase_transaction_id: sale.id,
    arrangement_kind: "delivery",
    schedule: change.schedule,
    location: change.location,
  });
  if (error) return error.message;
  await admin
    .from("purchase_details")
    .update({ location: change.location, reschedule_pending_at: null, reschedule_pending_location: null })
    .eq("transaction_id", sale.id);
  const { data: fieldCase } = await admin
    .from("field_cases")
    .update({ schedule: change.schedule, location: change.location })
    .eq("transaction_id", sale.id)
    .eq("case_kind", "delivery")
    .neq("state", "cancelled")
    .select("assigned_confidential_informant")
    .maybeSingle();

  const when = new Date(change.schedule).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  await admin.from("transaction_status_history").insert({
    transaction_id: sale.id,
    from_state: sale.current_state,
    to_state: sale.current_state,
    actor_id: actorId,
    reason: `Delivery moved to ${when} at ${change.location}${change.fee > 0 ? `; fee ₱${change.fee.toLocaleString("en-PH")}` : ""}`,
  });
  const message = {
    kind: "delivery_rescheduled",
    title: "Delivery re-scheduled by the buyer",
    body: `New delivery: ${when} at ${change.location}.`,
    transactionId: sale.id,
  };
  await notify(admin, { role: "sales_manager" }, message);
  if (fieldCase?.assigned_confidential_informant) {
    await notify(admin, { userId: fieldCase.assigned_confidential_informant as string }, message);
  }
  return null;
}

// §2 step 6, "Mark Sold"" to This Buyer": the car leaves the listings and every other open request
// for it ends, freeing their slots. Other buyers are told (Q13 default: yes).
export async function finalizeBuySale(
  admin: Admin,
  sale: { id: string; vehicle_id: string | null },
  actorId: string,
  options: { keepFlowStatus?: boolean } = {},
): Promise<void> {
  // A financed sale keeps "In-House Financing — Active" as its status; the account carries on.
  await admin
    .from("transactions")
    .update(options.keepFlowStatus ? { review_due_at: null } : { flow_status: "sold", review_due_at: null })
    .eq("id", sale.id);
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

// Appendix C: no-shows and Not Legit declines go on the buyer's record; customers cannot write it.
export async function recordStandingEvent(
  admin: Admin,
  customerId: string,
  event: "no_show" | "strike",
  actorId: string,
): Promise<Standing> {
  const { data: current } = await admin
    .from("customer_standing")
    .select("no_show_count, strike_count, gce_visit_only")
    .eq("account_id", customerId)
    .maybeSingle();
  const next = nextStanding(current as Standing | null, event);
  await admin.from("customer_standing").upsert({ account_id: customerId, ...next, updated_by: actorId });
  return next;
}
