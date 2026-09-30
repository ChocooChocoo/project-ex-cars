"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  addWorkingDays,
  balanceMethodPhrase,
  DOWNPAYMENT_WORKING_DAYS,
  verifiedPaid,
} from "@/lib/transactions/buy-flow";
import { releaseVisitSlots } from "@/lib/transactions/buy-flow-server";
import { canCancelScheduled } from "@/lib/transactions/state-machine";

type DeliveryActionResult = { error: string } | { success: true };
type Admin = ReturnType<typeof createAdminClient>;

const peso = (amount: unknown) => `₱${Number(amount).toLocaleString()}`;

async function salesManager(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" };
  const role = await getCurrentRole();
  if (!role || !["sales_manager", "ceo"].includes(role)) return { error: "Only the Sales Manager can do this." };
  return { userId: data.user.id };
}

// An approved Cash or bank-transfer Delivery request with its terms, payments, delivery slot and field case.
async function loadDelivery(admin: Admin, transactionId: unknown) {
  const id = z.string().uuid().safeParse(transactionId);
  if (!id.success) return null;
  const { data: tx } = await admin
    .from("transactions")
    .select(
      "id, customer_id, vehicle_id, current_state, transaction_kind, purchase_details(*), payment_records(payment_kind, amount, verified_by), viewing_arrangements(id, schedule, location, arrangement_kind, confirmation_state)",
    )
    .eq("id", id.data)
    .maybeSingle();
  if (tx?.transaction_kind !== "buy") return null;
  const details = (Array.isArray(tx.purchase_details) ? tx.purchase_details[0] : tx.purchase_details) as Record<
    string,
    unknown
  > | null;
  if (details?.arrangement_kind !== "delivery") return null;
  const arrangement =
    (
      (tx.viewing_arrangements ?? []) as {
        id: string;
        schedule: string;
        location: string | null;
        arrangement_kind: string;
        confirmation_state: string;
      }[]
    ).find((a) => a.arrangement_kind === "delivery" && ["pending", "confirmed"].includes(a.confirmation_state)) ?? null;
  const { data: fieldCase } = await admin
    .from("field_cases")
    .select("id, delivery_status, delay_note, expected_arrival")
    .eq("transaction_id", tx.id)
    .eq("case_kind", "delivery")
    .neq("state", "cancelled")
    .maybeSingle();
  return {
    ...tx,
    details,
    payments: (tx.payment_records ?? []) as { payment_kind: unknown; amount: unknown; verified_by: unknown }[],
    arrangement,
    fieldCase,
  };
}

function done(transactionId: string): DeliveryActionResult {
  revalidatePath("/dashboard/transactions");
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard/field-cases");
  return { success: true };
}

async function history(admin: Admin, tx: { id: string; current_state: string }, actorId: string, reason: string) {
  await admin.from("transaction_status_history").insert({
    transaction_id: tx.id,
    from_state: tx.current_state,
    to_state: tx.current_state,
    actor_id: actorId,
    reason,
  });
}

// §4 step 5, approval sequence 1–3: confirm the address is serviceable and set the fee and downpayment.
// Not serviceable ends the request. Q2 default: the delivery fee and the downpayment are two payments.
export async function setDeliveryTerms(formData: FormData): Promise<DeliveryActionResult> {
  const actor = await salesManager();
  if ("error" in actor) return actor;
  const parsed = z
    .object({
      serviceable: z.enum(["yes", "no"]),
      delivery_fee: z.coerce.number().min(0).optional().or(z.literal("")),
      downpayment_amount: z.coerce.number().positive().optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid delivery terms." };

  const admin = createAdminClient();
  const tx = await loadDelivery(admin, formData.get("transaction_id"));
  if (!tx) return { error: "Delivery request not found." };
  if (tx.current_state !== "approved") return { error: "Set delivery terms after approving the request." };
  if (tx.details?.downpayment_due_at) return { error: "Delivery terms are already set." };

  if (parsed.data.serviceable === "no") {
    await admin.from("purchase_details").update({ delivery_serviceable: false }).eq("transaction_id", tx.id);
    await admin
      .from("transactions")
      .update({ current_state: "rejected", completed_at: new Date().toISOString(), flow_status: null })
      .eq("id", tx.id);
    await admin.from("transaction_status_history").insert({
      transaction_id: tx.id,
      from_state: tx.current_state,
      to_state: "rejected",
      actor_id: actor.userId,
      reason: "Delivery address is not serviceable",
    });
    await releaseVisitSlots(admin, tx.id);
    await notify(
      admin,
      { userId: tx.customer_id },
      {
        kind: "delivery_not_serviceable",
        title: "We can't deliver to your address",
        body: "GCE cannot deliver to the address you gave. You can request the car again with a GCE visit or a meet-up.",
        transactionId: tx.id,
      },
    );
    return done(tx.id);
  }

  if (parsed.data.delivery_fee === "" || parsed.data.delivery_fee === undefined || !parsed.data.downpayment_amount) {
    return { error: "Set the delivery fee and the downpayment." };
  }
  const due = addWorkingDays(new Date(), DOWNPAYMENT_WORKING_DAYS);
  const { error } = await admin
    .from("purchase_details")
    .update({
      delivery_serviceable: true,
      delivery_fee: parsed.data.delivery_fee,
      downpayment_amount: parsed.data.downpayment_amount,
      downpayment_due_at: due.toISOString(),
    })
    .eq("transaction_id", tx.id);
  if (error) return { error: error.message };

  await history(
    admin,
    tx,
    actor.userId,
    `Delivery confirmed: fee ${peso(parsed.data.delivery_fee)}, downpayment ${peso(parsed.data.downpayment_amount)}`,
  );
  await notify(
    admin,
    { userId: tx.customer_id },
    {
      kind: "delivery_terms_set",
      title: "Your delivery is confirmed",
      body: `Pay the delivery fee of ${peso(parsed.data.delivery_fee)} and the downpayment of ${peso(parsed.data.downpayment_amount)} by bank transfer before ${due.toLocaleDateString("en-PH")}. The balance is paid ${balanceMethodPhrase(tx.details.payment_method)} on delivery.`,
      transactionId: tx.id,
    },
  );
  await notify(
    admin,
    { role: "head_accountant" },
    {
      kind: "delivery_payment_expected",
      title: "Delivery payments expected",
      body: `A buyer will pay a delivery fee of ${peso(parsed.data.delivery_fee)} and a downpayment of ${peso(parsed.data.downpayment_amount)} by bank transfer. Record and verify them on the transaction.`,
      transactionId: tx.id,
    },
  );
  return done(tx.id);
}

// §4 step 5: once the Head Accountant has verified the delivery fee, the Sales Manager sends the
// Mechanic, Confidential Informant and Head Security.
export async function createDeliveryFieldCase(formData: FormData): Promise<DeliveryActionResult> {
  const actor = await salesManager();
  if ("error" in actor) return actor;
  const parsed = z
    .object({
      informant_id: z.string().uuid("Choose a Confidential Informant."),
      mechanic_id: z.string().uuid("Choose a Mechanic."),
      head_security_id: z.string().uuid("Choose Head Security."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose the delivery team." };

  const admin = createAdminClient();
  const tx = await loadDelivery(admin, formData.get("transaction_id"));
  if (!tx) return { error: "Delivery request not found." };
  if (tx.current_state !== "approved" || !tx.details?.delivery_serviceable) {
    return { error: "Set the delivery terms first." };
  }
  if (tx.fieldCase) return { error: "A delivery field case already exists." };
  if (verifiedPaid(tx.payments, "delivery_fee") < Number(tx.details.delivery_fee ?? 0)) {
    return { error: "The Head Accountant must verify the delivery fee first." };
  }
  if (!tx.arrangement) return { error: "The request has no delivery date." };

  const supabase = await createServerSupabaseClient();
  const { data: workers } = await supabase.rpc("list_field_case_workers");
  const directory = (workers as { account_id: string; role: string }[] | null) ?? [];
  const is = (id: string, role: string) => directory.some((w) => w.account_id === id && w.role === role);
  if (!is(parsed.data.informant_id, "confidential_informant"))
    return { error: "Choose an active Confidential Informant." };
  if (!is(parsed.data.mechanic_id, "mechanic")) return { error: "Choose an active Mechanic." };
  if (!is(parsed.data.head_security_id, "head_security")) return { error: "Choose active Head Security." };

  const { error } = await admin.from("field_cases").insert({
    transaction_id: tx.id,
    vehicle_id: tx.vehicle_id,
    case_kind: "delivery",
    assigned_confidential_informant: parsed.data.informant_id,
    mechanic_id: parsed.data.mechanic_id,
    head_security_id: parsed.data.head_security_id,
    schedule: tx.arrangement.schedule,
    location: tx.arrangement.location,
    state: "assigned",
    notes: `Delivery. Collect the balance ${balanceMethodPhrase(tx.details.payment_method)} on delivery. Delivery fee ${peso(tx.details.delivery_fee)}, downpayment ${peso(tx.details.downpayment_amount)} by bank transfer.`,
  });
  if (error) return { error: error.message };

  await history(admin, tx, actor.userId, "Delivery field case created");
  for (const workerId of [parsed.data.informant_id, parsed.data.mechanic_id, parsed.data.head_security_id]) {
    await notify(
      admin,
      { userId: workerId },
      {
        kind: "field_case_assigned",
        title: "New delivery",
        body: `Deliver a car on ${new Date(tx.arrangement.schedule).toLocaleString("en-PH")} to ${tx.arrangement.location ?? "the buyer's address"}.`,
        transactionId: tx.id,
      },
    );
  }
  return done(tx.id);
}

// §4 step 7c: the buyer asked in advance (5 hours or more) for a new date or address; a fee applies,
// recorded by the Head Accountant as a reschedule_fee payment.
export async function rescheduleDelivery(formData: FormData): Promise<DeliveryActionResult> {
  const actor = await salesManager();
  if ("error" in actor) return actor;
  const parsed = z
    .object({
      schedule: z.string().min(1, "Set the new delivery date and time."),
      location: z.string().trim().min(1, "Set the delivery address.").max(500),
      fee: z.coerce.number().min(0, "The fee cannot be negative."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid reschedule." };
  const schedule = new Date(parsed.data.schedule);
  if (Number.isNaN(schedule.getTime()) || schedule.getTime() <= Date.now()) return { error: "Pick a future date." };

  const admin = createAdminClient();
  const tx = await loadDelivery(admin, formData.get("transaction_id"));
  if (!tx?.arrangement) return { error: "Delivery request not found." };
  if (tx.current_state !== "approved") return { error: "Only an approved delivery can be rescheduled." };
  if (!canCancelScheduled(tx.arrangement.schedule)) {
    return { error: "A change must be asked 5 hours or more before the scheduled delivery." };
  }

  await admin.from("viewing_arrangements").update({ confirmation_state: "cancelled" }).eq("id", tx.arrangement.id);
  const { error } = await admin.from("viewing_arrangements").insert({
    purchase_transaction_id: tx.id,
    arrangement_kind: "delivery",
    schedule: schedule.toISOString(),
    location: parsed.data.location,
  });
  if (error) return { error: error.message };
  if (tx.fieldCase) {
    await admin
      .from("field_cases")
      .update({ schedule: schedule.toISOString(), location: parsed.data.location })
      .eq("id", tx.fieldCase.id);
  }

  await history(
    admin,
    tx,
    actor.userId,
    `Delivery moved to ${schedule.toLocaleString("en-PH")} at ${parsed.data.location}; fee ${peso(parsed.data.fee)}`,
  );
  await notify(
    admin,
    { userId: tx.customer_id },
    {
      kind: "delivery_rescheduled",
      title: "Your delivery was rescheduled",
      body: `New delivery: ${schedule.toLocaleString("en-PH")} at ${parsed.data.location}.${parsed.data.fee > 0 ? ` Pay the ${peso(parsed.data.fee)} rescheduling fee by bank transfer.` : ""}`,
      transactionId: tx.id,
    },
  );
  return done(tx.id);
}

// §4 step 7b: the Sales Manager passes the Confidential Informant's delay report to the buyer.
// A delay caused by GCE carries no penalty.
export async function relayDeliveryDelay(formData: FormData): Promise<DeliveryActionResult> {
  const actor = await salesManager();
  if ("error" in actor) return actor;
  const admin = createAdminClient();
  const tx = await loadDelivery(admin, formData.get("transaction_id"));
  if (!tx?.fieldCase?.delay_note) return { error: "No delay has been reported." };

  const eta = tx.fieldCase.expected_arrival
    ? ` Expected arrival: ${new Date(tx.fieldCase.expected_arrival).toLocaleString("en-PH")}.`
    : "";
  await notify(
    admin,
    { userId: tx.customer_id },
    {
      kind: "delivery_delayed",
      title: "Your delivery will arrive late",
      body: `${tx.fieldCase.delay_note}.${eta} This delay is on GCE's side and has no effect on your record.`,
      transactionId: tx.id,
    },
  );
  await history(admin, tx, actor.userId, `Delay passed to the buyer: ${tx.fieldCase.delay_note}`);
  return done(tx.id);
}

// §4 step 5a: the downpayment deadline passed unpaid, so the request ends. Nothing was paid, so
// nothing is refunded; the Sales Manager then promotes the next On Hold request.
export async function cancelUnpaidDelivery(formData: FormData): Promise<DeliveryActionResult> {
  const actor = await salesManager();
  if ("error" in actor) return actor;
  const admin = createAdminClient();
  const tx = await loadDelivery(admin, formData.get("transaction_id"));
  if (!tx) return { error: "Delivery request not found." };
  const due = tx.details?.downpayment_due_at as string | null;
  if (tx.current_state !== "approved" || !due || new Date(due).getTime() > Date.now()) {
    return { error: "The downpayment deadline has not passed." };
  }
  if (verifiedPaid(tx.payments, "downpayment") >= Number(tx.details?.downpayment_amount ?? 0)) {
    return { error: "The downpayment is already paid." };
  }

  const { error } = await admin
    .from("transactions")
    .update({ current_state: "cancelled", completed_at: new Date().toISOString(), flow_status: null })
    .eq("id", tx.id);
  if (error) return { error: error.message };
  await admin.from("transaction_status_history").insert({
    transaction_id: tx.id,
    from_state: tx.current_state,
    to_state: "cancelled",
    actor_id: actor.userId,
    reason: "Downpayment not paid by the deadline",
  });
  await releaseVisitSlots(admin, tx.id);
  if (tx.fieldCase) await admin.from("field_cases").update({ state: "cancelled" }).eq("id", tx.fieldCase.id);
  await notify(
    admin,
    { userId: tx.customer_id },
    {
      kind: "delivery_cancelled_unpaid",
      title: "Your delivery request was cancelled",
      body: "The downpayment was not received by the deadline, so the request has been cancelled.",
      transactionId: tx.id,
    },
  );
  return done(tx.id);
}
