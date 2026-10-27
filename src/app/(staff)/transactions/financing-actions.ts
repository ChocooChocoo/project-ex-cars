"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addWorkingDays, DOWNPAYMENT_WORKING_DAYS, financedTotal } from "@/lib/transactions/buy-flow";
import { loadFinancing, openFinancingAccount } from "@/lib/transactions/financing-server";

type FinancingResult = { error: string } | { success: true };
type Admin = ReturnType<typeof createAdminClient>;

const peso = (amount: unknown) => `₱${Number(amount).toLocaleString()}`;

async function actor(roles: string[]): Promise<{ userId: string; role: string } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" };
  const role = await getCurrentRole();
  if (!role || !roles.includes(role)) return { error: "Not authorized for this financing step." };
  return { userId: data.user.id, role };
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

function purchase(tx: { purchase_details: unknown }) {
  return (Array.isArray(tx.purchase_details) ? tx.purchase_details[0] : tx.purchase_details) as {
    arrangement_kind?: string;
    final_price?: number | null;
  } | null;
}

function arrangementKind(tx: { purchase_details: unknown }): string | null {
  return purchase(tx)?.arrangement_kind ?? null;
}

function done(transactionId: string): FinancingResult {
  revalidatePath("/dashboard/transactions");
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath(`/my-transactions/${transactionId}`);
  return { success: true };
}

// §6 steps 6–7: the Sales Manager records the buyer's payment duration and proposes the Initial
// Downpayment and terms (Q6 default: the Sales Manager calculates, the Head Accountant reviews).
export async function proposeFinancingTerms(formData: FormData): Promise<FinancingResult> {
  const who = await actor(["sales_manager", "ceo"]);
  if ("error" in who) return who;
  const parsed = z
    .object({
      duration_months: z.coerce.number().int().min(1, "Choose a payment duration.").max(84),
      // T04 P6: left blank, it defaults to the car's price plus 10%.
      total_amount: z.coerce.number().positive("Enter the vehicle price.").optional().or(z.literal("")),
      down_payment: z.coerce.number().min(0).optional(),
      monthly_payment: z.coerce.number().positive("Enter the monthly payment."),
      first_due_date: z.string().min(1, "Set the first due date."),
      missed_payment_policy: z.string().trim().min(1, "State the missed payment policy.").max(1000),
      delivery_fee: z.coerce.number().min(0).optional(),
      notes: z.string().trim().max(500).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid terms." };

  const admin = createAdminClient();
  const tx = await loadFinancing(admin, formData.get("transaction_id"));
  if (!tx) return { error: "Financing request not found." };
  if (tx.current_state !== "approved") return { error: "Approve the request before proposing terms." };
  if (tx.terms && !["returned"].includes(tx.terms.state)) return { error: "Terms are already in review." };

  const totalAmount = parsed.data.total_amount || financedTotal(Number(purchase(tx)?.final_price ?? 0));
  if (!totalAmount) return { error: "Enter the vehicle price." };

  // A meet-up takes no downpayment. A delivery's fee and downpayment are approved with the terms.
  const kind = arrangementKind(tx);
  const delivery = kind === "delivery";
  if (delivery && !String(formData.get("delivery_fee") ?? "").trim()) return { error: "Enter the delivery fee." };
  const downPayment = kind === "meetup" ? 0 : (parsed.data.down_payment ?? 0);
  if (delivery && downPayment <= 0) return { error: "Enter the downpayment." };
  if (downPayment >= totalAmount) {
    return { error: "The Initial Downpayment must be below the vehicle price." };
  }

  const row = {
    purchase_transaction_id: tx.id,
    arrangement_description: parsed.data.notes || `${parsed.data.duration_months}-month In-House Financing`,
    total_amount: totalAmount,
    down_payment: downPayment,
    monthly_payment: parsed.data.monthly_payment,
    missed_payment_policy: parsed.data.missed_payment_policy,
    delivery_fee: delivery ? (parsed.data.delivery_fee ?? 0) : null,
    number_of_payments: parsed.data.duration_months,
    duration_months: parsed.data.duration_months,
    payment_frequency: "monthly",
    first_due_date: parsed.data.first_due_date,
    agreed_by: who.userId,
    state: "proposed",
    returned_reason: null,
    ha_reviewed_by: null,
    ha_reviewed_at: null,
  };
  const { error } = tx.terms
    ? await admin.from("payment_terms").update(row).eq("id", tx.terms.id)
    : await admin.from("payment_terms").insert(row);
  if (error) return { error: error.message };

  await history(
    admin,
    tx,
    who.userId,
    `Financing proposed: ${parsed.data.duration_months} months, downpayment ${peso(downPayment)}`,
  );
  await notify(
    admin,
    { role: "head_accountant" },
    {
      kind: "financing_terms_proposed",
      title: "Financing terms to review",
      body: `${parsed.data.duration_months} months on ${peso(totalAmount)}, Initial Downpayment ${peso(downPayment)}.`,
      transactionId: tx.id,
    },
  );
  return done(tx.id);
}

// §6 step 8: the Head Accountant approves the terms for the CEO, or returns them with a reason.
export async function reviewFinancingTerms(formData: FormData): Promise<FinancingResult> {
  const who = await actor(["head_accountant"]);
  if ("error" in who) return who;
  const parsed = z
    .object({
      decision: z.enum(["approve", "return"]),
      reason: z.string().trim().max(500).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid review." };
  if (parsed.data.decision === "return" && !parsed.data.reason) return { error: "Say what needs to change." };

  const admin = createAdminClient();
  const tx = await loadFinancing(admin, formData.get("transaction_id"));
  if (tx?.terms?.state !== "proposed") return { error: "No proposed terms to review." };

  const approve = parsed.data.decision === "approve";
  const { error } = await admin
    .from("payment_terms")
    .update(
      approve
        ? { state: "ha_approved", ha_reviewed_by: who.userId, ha_reviewed_at: new Date().toISOString() }
        : { state: "returned", returned_reason: parsed.data.reason },
    )
    .eq("id", tx.terms.id);
  if (error) return { error: error.message };

  await history(
    admin,
    tx,
    who.userId,
    approve ? "Head Accountant approved the financing terms" : `Terms returned: ${parsed.data.reason}`,
  );
  await notify(
    admin,
    { role: approve ? "ceo" : "sales_manager" },
    {
      kind: approve ? "financing_terms_reviewed" : "financing_terms_returned",
      title: approve ? "Financing terms to confirm" : "Financing terms returned",
      body: approve
        ? "The Head Accountant approved the financing terms."
        : `Revise and resubmit: ${parsed.data.reason}`,
      transactionId: tx.id,
    },
  );
  return done(tx.id);
}

// §6 steps 9–10: the CEO confirms the terms, which become the buyer's offer, or returns them.
export async function confirmFinancingTerms(formData: FormData): Promise<FinancingResult> {
  const who = await actor(["ceo"]);
  if ("error" in who) return who;
  const parsed = z
    .object({
      decision: z.enum(["confirm", "return"]),
      reason: z.string().trim().max(500).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid decision." };
  if (parsed.data.decision === "return" && !parsed.data.reason) return { error: "Say what needs to change." };

  const admin = createAdminClient();
  const tx = await loadFinancing(admin, formData.get("transaction_id"));
  if (tx?.terms?.state !== "ha_approved") return { error: "No reviewed terms to confirm." };

  if (parsed.data.decision === "return") {
    await admin
      .from("payment_terms")
      .update({ state: "returned", returned_reason: parsed.data.reason })
      .eq("id", tx.terms.id);
    await history(admin, tx, who.userId, `CEO returned the terms: ${parsed.data.reason}`);
    await notify(
      admin,
      { role: "sales_manager" },
      {
        kind: "financing_terms_returned",
        title: "Financing terms returned by the CEO",
        body: `Revise and resubmit: ${parsed.data.reason}`,
        transactionId: tx.id,
      },
    );
    return done(tx.id);
  }

  // A delivery was dated at request, so the confirmation sets its payment terms and holds the car.
  const kind = arrangementKind(tx);
  const delivery = kind === "delivery";
  let deliveryOn = "";
  if (delivery) {
    const { data: slot } = await admin
      .from("viewing_arrangements")
      .select("schedule, location")
      .eq("purchase_transaction_id", tx.id)
      .eq("arrangement_kind", "delivery")
      .in("confirmation_state", ["pending", "confirmed"])
      .maybeSingle();
    if (!slot) return { error: "The request has no delivery date." };
    deliveryOn = new Date(slot.schedule).toLocaleString("en-PH");
  }

  const { error } = await admin
    .from("payment_terms")
    .update({ state: "approved", approver_id: who.userId, approval_date: new Date().toISOString() })
    .eq("id", tx.terms.id);
  if (error) return { error: error.message };
  await history(admin, tx, who.userId, "CEO confirmed the financing terms");

  const remaining = Number(tx.terms.total_amount) - Number(tx.terms.down_payment);
  const monthly = tx.terms.monthly_payment
    ? `${peso(tx.terms.monthly_payment)} a month for ${tx.terms.number_of_payments} months`
    : `${tx.terms.number_of_payments} monthly payments`;

  if (delivery) {
    const fee = Number(tx.terms.delivery_fee ?? 0);
    const due = addWorkingDays(new Date(), DOWNPAYMENT_WORKING_DAYS);
    await admin
      .from("purchase_details")
      .update({
        delivery_serviceable: true,
        delivery_fee: fee,
        downpayment_amount: tx.terms.down_payment,
        downpayment_due_at: due.toISOString(),
      })
      .eq("transaction_id", tx.id);
    await admin.from("transactions").update({ flow_status: "purchase_claim" }).eq("id", tx.id);
    await notify(
      admin,
      { userId: tx.customer_id },
      {
        kind: "financing_offer",
        title: "Your financing and delivery are confirmed",
        body: `Delivery fee ${peso(fee)} and downpayment ${peso(tx.terms.down_payment)}: pay ${peso(fee + Number(tx.terms.down_payment))} now through PayMongo, by ${due.toLocaleDateString("en-PH")}. Amount financed ${peso(remaining)}, ${monthly}. Delivery on ${deliveryOn}.`,
        transactionId: tx.id,
      },
    );
    await notify(
      admin,
      { role: "head_accountant" },
      {
        kind: "delivery_payment_expected",
        title: "Delivery payments expected",
        body: `A buyer will pay a delivery fee of ${peso(fee)} and a downpayment of ${peso(tx.terms.down_payment)}. Record and verify them on the transaction.`,
        transactionId: tx.id,
      },
    );
    return done(tx.id);
  }

  await admin.from("transactions").update({ flow_status: "approved_awaiting_buyer_decision" }).eq("id", tx.id);
  await notify(
    admin,
    { userId: tx.customer_id },
    {
      kind: "financing_offer",
      title: "Your financing is approved",
      body:
        kind === "meetup"
          ? `No downpayment. ${peso(remaining)} financed, ${monthly}. Review it and book your meet-up, or decline.`
          : `Initial Downpayment ${peso(tx.terms.down_payment)}, then ${monthly} on a balance of ${peso(remaining)}. Review it and book your GCE visit, or decline.`,
      transactionId: tx.id,
    },
  );
  return done(tx.id);
}

// §6 steps 14–16: after inspecting the car, the buyer either claims it (the car is reserved) or needs
// time (Potential Buyer: nothing reserved, the next queued buyer may be promoted).
export async function recordVisitDecision(formData: FormData): Promise<FinancingResult> {
  const who = await actor(["sales_manager", "ceo"]);
  if ("error" in who) return who;
  const decision = z.enum(["claim", "potential"]).safeParse(formData.get("decision"));
  if (!decision.success) return { error: "Invalid decision." };

  const admin = createAdminClient();
  const tx = await loadFinancing(admin, formData.get("transaction_id"));
  if (!tx?.vehicle_id || tx.current_state !== "approved") return { error: "Financing request not found." };
  if (!["gce_visit_scheduled_dp_pending", "potential_buyer"].includes(tx.flow_status ?? "")) {
    return { error: "Record the decision after the buyer's GCE visit." };
  }

  await admin
    .from("viewing_arrangements")
    .update({ confirmation_state: "completed" })
    .eq("purchase_transaction_id", tx.id)
    .in("confirmation_state", ["pending", "confirmed"]);

  if (decision.data === "potential") {
    await admin.from("transactions").update({ flow_status: "potential_buyer", queue_state: null }).eq("id", tx.id);
    await history(admin, tx, who.userId, "Potential Buyer: needs time, car not reserved");
    return done(tx.id);
  }

  const { data: vehicle } = await admin.from("vehicles").select("listing_state").eq("id", tx.vehicle_id).single();
  if (vehicle?.listing_state === "reserved")
    return { error: "Another buyer already holds a Purchase Claim on this car." };
  await admin.from("vehicles").update({ listing_state: "reserved" }).eq("id", tx.vehicle_id);
  await admin.from("transactions").update({ flow_status: "purchase_claim" }).eq("id", tx.id);
  await history(admin, tx, who.userId, "Purchase Claim recorded; car reserved for this buyer");

  // Other buyers for the car are told it is now under a claim (§6 step 16).
  const { data: others } = await admin
    .from("transactions")
    .select("id, customer_id")
    .eq("vehicle_id", tx.vehicle_id)
    .eq("transaction_kind", "buy")
    .neq("id", tx.id)
    .in("current_state", ["pending", "under_review", "approved"]);
  for (const other of others ?? []) {
    await notify(
      admin,
      { userId: other.customer_id },
      {
        kind: "vehicle_claimed",
        title: "This car is now under a Purchase Claim",
        body: "Another buyer has claimed the car you asked about. Your request stays open in case the claim ends.",
        transactionId: other.id,
      },
    );
  }
  return done(tx.id);
}

// §6 step 19: once the Initial Downpayment is verified, the financing agreement is completed and the
// account with its monthly installments opens.
export async function completeFinancingAgreement(formData: FormData): Promise<FinancingResult> {
  const who = await actor(["head_accountant", "ceo"]);
  if ("error" in who) return who;
  const admin = createAdminClient();
  const tx = await loadFinancing(admin, formData.get("transaction_id"));
  if (!tx?.terms) return { error: "Financing request not found." };
  // A meet-up takes no downpayment: its agreement waits only for the signing.
  const kind = arrangementKind(tx);
  if (tx.terms.state !== "approved" || (kind !== "meetup" && tx.flow_status !== "initial_dp_confirmed")) {
    return {
      error:
        kind === "meetup"
          ? "Complete the agreement after the financing is confirmed."
          : "Complete the agreement after the Initial Downpayment is confirmed.",
    };
  }
  // §11 (Phase 6 default): a financed delivery is signed after the buyer accepts the car at the door, so a
  // decline on delivery never leaves an open account.
  if (kind === "delivery") {
    const { data: delivery } = await admin
      .from("field_cases")
      .select("delivery_status")
      .eq("transaction_id", tx.id)
      .eq("case_kind", "delivery")
      .neq("state", "cancelled")
      .maybeSingle();
    if (delivery?.delivery_status !== "delivered") {
      return { error: "Complete the agreement after the car is delivered and the buyer accepts it." };
    }
  }
  // In the field the Confidential Informant reports the signing before the account opens.
  if (kind === "meetup" || kind === "delivery") {
    const { data: handover } = await admin
      .from("sale_handovers")
      .select("signing_reported_at")
      .eq("transaction_id", tx.id)
      .maybeSingle();
    if (!handover?.signing_reported_at) {
      return { error: "Complete the agreement after the Confidential Informant reports that the buyer signed." };
    }
  }

  const error = await openFinancingAccount(admin, tx.terms);
  if (error) return { error };
  await admin.from("transactions").update({ flow_status: "financing_active" }).eq("id", tx.id);
  await history(admin, tx, who.userId, "Financing agreement completed; account active");
  await notify(
    admin,
    { role: "sales_manager" },
    {
      kind: "financing_active",
      title: "Financing is active",
      body: "The financing account is open. Mark the car sold to this buyer.",
      transactionId: tx.id,
    },
  );
  return done(tx.id);
}

// §6 step 26.8–10: the recovery team brought the car back. The account closes as repossessed and the
// Mechanic's reconditioning job opens (steps 27–30).
export async function recordVehicleRecovered(formData: FormData): Promise<FinancingResult> {
  const who = await actor(["head_accountant"]);
  if ("error" in who) return who;
  const id = z.string().uuid().safeParse(formData.get("transaction_id"));
  if (!id.success) return { error: "Invalid request." };

  const admin = createAdminClient();
  const { data: tx } = await admin
    .from("transactions")
    .select("id, customer_id, vehicle_id, current_state, flow_status")
    .eq("id", id.data)
    .maybeSingle();
  if (!tx?.vehicle_id) return { error: "Transaction not found." };
  if (tx.flow_status === "repossessed") return { error: "The car is already recorded as recovered." };

  const { data: recovery } = await admin
    .from("field_cases")
    .select("id")
    .eq("transaction_id", tx.id)
    .eq("case_kind", "recovery")
    .neq("state", "cancelled")
    .maybeSingle();
  if (!recovery) return { error: "Instruct the repossession first." };

  await admin
    .from("field_cases")
    .update({ state: "completed", completion_date: new Date().toISOString() })
    .eq("id", recovery.id);
  await admin
    .from("installment_accounts")
    .update({ state: "repossessed", closed_date: new Date().toISOString().slice(0, 10) })
    .eq("purchase_transaction_id", tx.id);
  await admin.from("transactions").update({ flow_status: "repossessed" }).eq("id", tx.id);
  await admin.from("vehicles").update({ listing_state: "repairing" }).eq("id", tx.vehicle_id);
  const { error } = await admin
    .from("reconditioning_jobs")
    .insert({ vehicle_id: tx.vehicle_id, transaction_id: tx.id, state: "awaiting_report" });
  if (error && error.code !== "23505") return { error: error.message };

  await history(admin, tx, who.userId, "Repossessed / Recovered by GCE");
  for (const role of ["mechanic", "sales_manager"]) {
    await notify(
      admin,
      { role },
      {
        kind: "vehicle_recovered",
        title: "Repossessed car returned to GCE",
        body:
          role === "mechanic"
            ? "Inspect the car and submit the Overall Vehicle Status Report with a restoration estimate."
            : "Re-process the car's papers while it is reconditioned.",
        transactionId: tx.id,
      },
    );
  }
  return done(tx.id);
}
