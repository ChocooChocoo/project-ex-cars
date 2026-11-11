"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  addWorkingDays,
  DOWNPAYMENT_WORKING_DAYS,
  deliveryBalanceNote,
  upfrontPaymentsCleared,
  verifiedPaid,
} from "@/lib/transactions/buy-flow";
import { releaseVisitSlots } from "@/lib/transactions/buy-flow-server";
import {
  DELIVERY_AREA_LABELS,
  deliveryArea,
  deliveryFeeRangeLabel,
  downPaymentFor,
  feeWithinRange,
} from "@/lib/transactions/delivery-fee";
import { bookedMeetup, meetupTeamError, openMeetupCase } from "@/lib/transactions/meetup-server";

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
      "id, customer_id, vehicle_id, current_state, flow_status, transaction_kind, opened_at, purchase_details(*), payment_records(payment_kind, amount, verified_by), viewing_arrangements(id, schedule, location, arrangement_kind, confirmation_state)",
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
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid delivery terms." };

  const admin = createAdminClient();
  const tx = await loadDelivery(admin, formData.get("transaction_id"));
  if (!tx) return { error: "Delivery request not found." };
  if (tx.current_state !== "approved") return { error: "Set delivery terms after approving the request." };
  if (tx.details?.downpayment_due_at) return { error: "Delivery terms are already set." };
  // A financed delivery's fee and downpayment are approved with the financing terms (confirmFinancingTerms).
  // Only "not serviceable" is decided here.
  if (tx.details?.payment_method === "financing" && parsed.data.serviceable === "yes") {
    return { error: "Set the delivery fee and the downpayment in the financing terms." };
  }

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

  if (parsed.data.delivery_fee === "" || parsed.data.delivery_fee === undefined) {
    return { error: "Set the delivery fee." };
  }

  // T05 P7: the fee must sit in the range for the buyer's region, and a CALABARZON delivery is free.
  const { data: buyer } = await admin.from("profiles").select("region_code").eq("id", tx.customer_id).maybeSingle();
  const area = deliveryArea(buyer?.region_code);
  if (!area) return { error: "Buyer has no region in their profile." };
  const fee = area === "calabarzon" ? 0 : parsed.data.delivery_fee;
  if (!feeWithinRange(area, fee)) {
    return { error: `The delivery fee for ${DELIVERY_AREA_LABELS[area]} is ${deliveryFeeRangeLabel(area)}.` };
  }

  // T05 P7: the down payment is 10% of the vehicle price, computed here and never typed by hand.
  const price = Number(tx.details?.final_price ?? 0);
  if (!(price > 0)) return { error: "Set the vehicle price first." };
  const downPayment = downPaymentFor(price);

  const due = addWorkingDays(new Date(), DOWNPAYMENT_WORKING_DAYS);
  const { error } = await admin
    .from("purchase_details")
    .update({
      delivery_serviceable: true,
      delivery_fee: fee,
      downpayment_amount: downPayment,
      downpayment_due_at: due.toISOString(),
    })
    .eq("transaction_id", tx.id);
  if (error) return { error: error.message };

  await history(admin, tx, actor.userId, `Delivery confirmed: fee ${peso(fee)}, downpayment ${peso(downPayment)}`);
  await notify(
    admin,
    { userId: tx.customer_id },
    {
      kind: "delivery_terms_set",
      title: "Your delivery is confirmed",
      body: `Pay the delivery fee of ${peso(fee)} and the downpayment of ${peso(downPayment)} through PayMongo before ${due.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}. ${deliveryBalanceNote(tx.details.payment_method, "buyer")}`,
      transactionId: tx.id,
    },
  );
  await notify(
    admin,
    { role: "head_accountant" },
    {
      kind: "delivery_payment_expected",
      title: "Delivery payments expected",
      body: `A buyer will pay a delivery fee of ${peso(fee)} and a downpayment of ${peso(downPayment)} through PayMongo. Check the receipts and verify them on the transaction.`,
      transactionId: tx.id,
    },
  );
  return done(tx.id);
}

// §4 step 5: once the Head Accountant has verified the delivery fee, the Sales Manager sends the
// Confidential Informant and Head Security. A delivery takes no Mechanic.
export async function createDeliveryFieldCase(formData: FormData): Promise<DeliveryActionResult> {
  const actor = await salesManager();
  if ("error" in actor) return actor;
  const parsed = z
    .object({
      informant_id: z.string().uuid("Choose a Confidential Informant."),
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
  // T10: no field case before the buyer has paid the delivery fee and the downpayment.
  if (!upfrontPaymentsCleared(tx.details, tx.payments)) {
    return { error: "The buyer must pay the delivery fee and the downpayment, verified, first." };
  }
  if (!tx.arrangement) return { error: "The request has no delivery date." };

  const supabase = await createServerSupabaseClient();
  const { data: workers } = await supabase.rpc("list_field_case_workers");
  const directory = (workers as { account_id: string; role: string }[] | null) ?? [];
  const is = (id: string, role: string) => directory.some((w) => w.account_id === id && w.role === role);
  if (!is(parsed.data.informant_id, "confidential_informant"))
    return { error: "Choose an active Confidential Informant." };
  if (!is(parsed.data.head_security_id, "head_security")) return { error: "Choose active Head Security." };

  const { error } = await admin.from("field_cases").insert({
    transaction_id: tx.id,
    vehicle_id: tx.vehicle_id,
    case_kind: "delivery",
    assigned_confidential_informant: parsed.data.informant_id,
    head_security_id: parsed.data.head_security_id,
    schedule: tx.arrangement.schedule,
    location: tx.arrangement.location,
    state: "assigned",
    notes: `Delivery. ${deliveryBalanceNote(tx.details.payment_method, "team")} Delivery fee ${peso(tx.details.delivery_fee)}, downpayment ${peso(tx.details.downpayment_amount)} paid through PayMongo.`,
  });
  if (error) return { error: error.message };

  await history(admin, tx, actor.userId, "Delivery field case created");
  for (const workerId of [parsed.data.informant_id, parsed.data.head_security_id]) {
    await notify(
      admin,
      { userId: workerId },
      {
        kind: "field_case_assigned",
        title: "New delivery",
        body: `Deliver a car on ${new Date(tx.arrangement.schedule).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} to ${tx.arrangement.location ?? "the buyer's address"}.`,
        transactionId: tx.id,
      },
    );
  }
  return done(tx.id);
}

// Meet Halfway: the Sales Manager assigns a Confidential Informant and a Mechanic and sends the command.
// A cash request gets its team with the approval; this covers a financed one, whose team is assigned only
// after the Head Accountant approves the contract and the buyer books the meet-up.
export async function createMeetupFieldCase(formData: FormData): Promise<DeliveryActionResult> {
  const actor = await salesManager();
  if ("error" in actor) return actor;
  const parsed = z
    .object({
      transaction_id: z.string().uuid(),
      informant_id: z.string().uuid("Choose a Confidential Informant."),
      mechanic_id: z.string().uuid("Choose a Mechanic."),
    })
    .safeParse({
      transaction_id: formData.get("transaction_id"),
      informant_id: formData.get("informant_id") ?? "",
      mechanic_id: formData.get("mechanic_id") ?? "",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose the meet-up team." };

  const admin = createAdminClient();
  const { data: tx } = await admin
    .from("transactions")
    .select(
      "id, customer_id, vehicle_id, current_state, transaction_kind, purchase_details(payment_method, arrangement_kind, downpayment_amount, delivery_fee), sale_handovers(contract_state), payment_records(payment_kind, amount, verified_by)",
    )
    .eq("id", parsed.data.transaction_id)
    .maybeSingle();
  const details = Array.isArray(tx?.purchase_details) ? tx.purchase_details[0] : tx?.purchase_details;
  if (tx?.transaction_kind !== "buy" || tx.current_state !== "approved" || details?.arrangement_kind !== "meetup") {
    return { error: "Approved meet-up request not found." };
  }
  if (details.payment_method === "financing") {
    const handover = Array.isArray(tx.sale_handovers) ? tx.sale_handovers[0] : tx.sale_handovers;
    if (!["approved", "signed"].includes(handover?.contract_state ?? "")) {
      return { error: "The Head Accountant must approve the contract first." };
    }
  }
  // T10: a Bank Transfer meet-up's downpayment is paid and verified before the team goes out.
  if (!upfrontPaymentsCleared(details, tx.payment_records ?? [])) {
    return { error: "The buyer must pay the downpayment, verified, first." };
  }
  const meetup = await bookedMeetup(admin, tx.id);
  if (!meetup) return { error: "The buyer has not booked the meet-up yet." };
  const { data: existing } = await admin
    .from("field_cases")
    .select("id")
    .eq("transaction_id", tx.id)
    .eq("case_kind", "buyer_meetup")
    .neq("state", "cancelled")
    .maybeSingle();
  if (existing) return { error: "The meet-up team is already assigned." };

  const supabase = await createServerSupabaseClient();
  const teamError = await meetupTeamError(supabase, parsed.data.informant_id, parsed.data.mechanic_id);
  if (teamError) return { error: teamError };

  const error = await openMeetupCase(
    admin,
    tx,
    { informantId: parsed.data.informant_id, mechanicId: parsed.data.mechanic_id },
    meetup,
    actor.userId,
  );
  if (error) return { error };
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
    ? ` Expected arrival: ${new Date(tx.fieldCase.expected_arrival).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}.`
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
