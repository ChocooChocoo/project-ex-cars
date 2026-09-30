"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { logAuditEvent } from "@/lib/auth/audit";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { approvedCeiling, SELL_MEETUP_METHOD_LABELS, sellPapersVerified } from "@/lib/transactions/sell-flow";
import { loadSellTransaction, moveSellTransaction } from "@/lib/transactions/sell-flow-server";
import { reviewDueAt } from "@/lib/transactions/state-machine";

type SellActionResult = { error: string } | { success: true };

const transactionIdSchema = z.string().uuid();
const money = z.coerce.number().positive("Enter an amount above zero.");

// Q0b: the Marketing Specialist owns the sell offer.
async function marketingSpecialist(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" };
  if ((await getCurrentRole()) !== "marketing_specialist") {
    return { error: "Only the Marketing Specialist can handle sell offers." };
  }
  return { userId: data.user.id };
}

function done(transactionId: string): SellActionResult {
  revalidatePath("/dashboard/transactions");
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  return { success: true };
}

const peso = (amount: unknown) => `₱${Number(amount).toLocaleString()}`;

// Selling step 2: a failed check flags the offer for follow-up or rejects it outright.
export async function flagSellSubmission(formData: FormData): Promise<SellActionResult> {
  const actor = await marketingSpecialist();
  if ("error" in actor) return actor;

  const parsed = z
    .object({
      transaction_id: transactionIdSchema,
      outcome: z.enum(["flag", "reject"]),
      reason: z.string().trim().min(1, "Give the reason.").max(1000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const admin = createAdminClient();
  const tx = await loadSellTransaction(admin, parsed.data.transaction_id);
  if (!tx) return { error: "Sell transaction not found." };
  if (tx.current_state !== "pending") return { error: "Only a submitted offer awaiting verification can be flagged." };

  const reject = parsed.data.outcome === "reject";
  const error = await moveSellTransaction(
    admin,
    tx,
    actor.userId,
    reject ? { current_state: "rejected" } : { flag: "flagged" },
    `${reject ? "Rejected" : "Flagged"} at verification: ${parsed.data.reason}`,
  );
  if (error) return { error };

  await notify(
    admin,
    { userId: tx.customer_id },
    {
      kind: reject ? "sell_offer_rejected" : "sell_offer_flagged",
      title: reject ? "Your vehicle offer was rejected" : "Your vehicle offer needs attention",
      body: parsed.data.reason,
      transactionId: tx.id,
    },
  );
  await logAuditEvent({
    actorId: actor.userId,
    action: reject ? "sell_rejected" : "sell_flagged",
    recordKind: "transactions",
    recordId: tx.id,
    summary: `Sell offer ${tx.id} ${reject ? "rejected" : "flagged"} at verification`,
  });
  return done(tx.id);
}

// Selling step 3: propose the purchase ceiling to the CEO and open the 7-day window.
export async function proposePurchaseCeiling(formData: FormData): Promise<SellActionResult> {
  const actor = await marketingSpecialist();
  if ("error" in actor) return actor;

  const parsed = z
    .object({
      transaction_id: transactionIdSchema,
      amount: money,
      notes: z.string().trim().max(1000).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid proposal." };

  const admin = createAdminClient();
  const tx = await loadSellTransaction(admin, parsed.data.transaction_id);
  if (!tx?.vehicle_id) return { error: "Sell transaction not found." };
  if (tx.current_state !== "pending") return { error: "A ceiling can only be proposed for a submitted offer." };

  const { data: documents } = await admin
    .from("transaction_documents")
    .select("document_kind, verification_state")
    .eq("transaction_id", tx.id);
  if (!sellPapersVerified(documents ?? [])) {
    return { error: "Verify two valid IDs, the ORCR and the deed of sale before proposing a ceiling." };
  }

  const { error: proposalError } = await admin.from("vehicle_price_proposals").insert({
    vehicle_id: tx.vehicle_id,
    transaction_id: tx.id,
    proposal_kind: "purchase_ceiling",
    proposed_amount: parsed.data.amount,
    proposer_id: actor.userId,
    decision: "pending",
    notes: parsed.data.notes || null,
  });
  if (proposalError) return { error: proposalError.message };

  const error = await moveSellTransaction(
    admin,
    tx,
    actor.userId,
    { current_state: "under_review", flow_status: "pending_ceo_approval", review_due_at: reviewDueAt(), flag: null },
    `Purchase ceiling of ${peso(parsed.data.amount)} proposed to the CEO`,
  );
  if (error) return { error };

  await notify(
    admin,
    { role: "ceo" },
    {
      kind: "ceiling_proposed",
      title: "Purchase ceiling awaiting approval",
      body: `A purchase ceiling of ${peso(parsed.data.amount)} awaits your decision within 7 days.`,
      transactionId: tx.id,
    },
  );
  // Q9 default: the seller sees the process doc's own wording.
  await notify(
    admin,
    { userId: tx.customer_id },
    {
      kind: "sell_offer_in_review",
      title: "Your vehicle offer is being reviewed",
      body: "GCE has verified your papers. Expect a response within 5–7 days.",
      transactionId: tx.id,
    },
  );
  return done(tx.id);
}

// Selling step 5: record the price agreed in the chat and hand the car to the field team.
export async function recordAgreedPrice(formData: FormData): Promise<SellActionResult> {
  const actor = await marketingSpecialist();
  if ("error" in actor) return actor;

  const parsed = z
    .object({
      transaction_id: transactionIdSchema,
      agreed_price: money,
      informant_id: z.string().uuid("Choose a Confidential Informant."),
      mechanic_id: z.string().uuid().optional().or(z.literal("")),
      schedule: z.string().min(1, "Set the meet-up date and time."),
      location: z.string().trim().min(1, "Set the meet-up location.").max(500),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid agreement." };
  const schedule = new Date(parsed.data.schedule);
  if (Number.isNaN(schedule.getTime())) return { error: "Set a valid meet-up date and time." };

  const admin = createAdminClient();
  const tx = await loadSellTransaction(admin, parsed.data.transaction_id);
  if (!tx?.vehicle_id) return { error: "Sell transaction not found." };
  if (tx.current_state !== "approved") return { error: "Agree a price only after the CEO approves the ceiling." };

  const { data: existingCase } = await admin
    .from("field_cases")
    .select("id")
    .eq("transaction_id", tx.id)
    .eq("case_kind", "acquisition")
    .maybeSingle();
  if (existingCase) return { error: "A field case already exists for this offer." };

  const { data: proposals } = await admin
    .from("vehicle_price_proposals")
    .select("proposal_kind, decision, proposed_amount, created_at")
    .eq("transaction_id", tx.id);
  const ceiling = approvedCeiling(proposals ?? []);
  if (ceiling === null) return { error: "No approved ceiling for this offer." };
  if (parsed.data.agreed_price > ceiling) {
    return { error: `The agreed price must stay within the approved ceiling of ${peso(ceiling)}.` };
  }

  // Workers come from the guarded directory, so only active informants and mechanics can be assigned.
  const supabase = await createServerSupabaseClient();
  const { data: workers } = await supabase.rpc("list_field_case_workers");
  const directory = (workers as { account_id: string; role: string }[] | null) ?? [];
  const isWorker = (id: string, role: string) => directory.some((w) => w.account_id === id && w.role === role);
  if (!isWorker(parsed.data.informant_id, "confidential_informant")) {
    return { error: "The selected user is not an active Confidential Informant." };
  }
  const mechanicId = parsed.data.mechanic_id || null;
  if (mechanicId && !isWorker(mechanicId, "mechanic")) return { error: "The selected user is not an active mechanic." };

  const { error: priceError } = await admin
    .from("sell_details")
    .update({ agreed_price: parsed.data.agreed_price })
    .eq("transaction_id", tx.id);
  if (priceError) return { error: priceError.message };

  const method = tx.sell?.meetup_method as keyof typeof SELL_MEETUP_METHOD_LABELS | undefined;
  const { data: fieldCase, error: caseError } = await admin
    .from("field_cases")
    .insert({
      transaction_id: tx.id,
      vehicle_id: tx.vehicle_id,
      case_kind: "acquisition",
      assigned_confidential_informant: parsed.data.informant_id,
      mechanic_id: mechanicId,
      schedule: schedule.toISOString(),
      location: parsed.data.location,
      state: "assigned",
      notes: `Seller meet-up (${method ? SELL_MEETUP_METHOD_LABELS[method] : "method not set"}). Agreed price ${peso(parsed.data.agreed_price)}.`,
    })
    .select("id")
    .single();
  if (caseError) return { error: caseError.message };

  await admin.from("transaction_status_history").insert({
    transaction_id: tx.id,
    from_state: tx.current_state,
    to_state: tx.current_state,
    actor_id: actor.userId,
    reason: `Price agreed at ${peso(parsed.data.agreed_price)}; acquisition field case created`,
  });
  for (const workerId of [parsed.data.informant_id, mechanicId]) {
    if (!workerId) continue;
    await notify(
      admin,
      { userId: workerId },
      {
        kind: "field_case_assigned",
        title: "New seller meet-up",
        body: `Inspect a seller's car on ${schedule.toLocaleString("en-PH")} at ${parsed.data.location}.`,
        transactionId: tx.id,
      },
    );
  }
  await logAuditEvent({
    actorId: actor.userId,
    action: "field_case_created_acquisition",
    recordKind: "field_cases",
    recordId: fieldCase.id,
    summary: `Acquisition field case created for sell offer ${tx.id}`,
  });
  revalidatePath("/dashboard/field-cases");
  return done(tx.id);
}

// Selling step 7: the Marketing Specialist turns the field team's finding into an Inspection Issue Report.
export async function createInspectionIssueReport(formData: FormData): Promise<SellActionResult> {
  const actor = await marketingSpecialist();
  if ("error" in actor) return actor;

  const parsed = z
    .object({
      transaction_id: transactionIdSchema,
      is_profitable: z.enum(["yes", "no"]),
      profitability_reason: z.string().trim().min(1, "Explain the profitability decision.").max(2000),
      recalculated_price: z.coerce.number().positive().optional().or(z.literal("")),
      new_ceiling: z.coerce.number().positive().optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid report." };

  const profitable = parsed.data.is_profitable === "yes";
  const recalculated = parsed.data.recalculated_price || null;
  const newCeiling = parsed.data.new_ceiling || null;
  if (profitable && (!recalculated || !newCeiling)) {
    return { error: "A profitable vehicle needs a recalculated price and a new ceiling." };
  }
  if (profitable && recalculated && newCeiling && recalculated > newCeiling) {
    return { error: "The recalculated price cannot exceed the new ceiling." };
  }

  const admin = createAdminClient();
  const tx = await loadSellTransaction(admin, parsed.data.transaction_id);
  if (!tx?.vehicle_id) return { error: "Sell transaction not found." };
  if (tx.current_state !== "approved") return { error: "This offer is not waiting for an inspection report." };

  const { data: fieldCase } = await admin
    .from("field_cases")
    .select("id, inspection_outcome, issue_description, repair_estimate, assigned_confidential_informant, mechanic_id")
    .eq("transaction_id", tx.id)
    .eq("case_kind", "acquisition")
    .maybeSingle();
  if (fieldCase?.inspection_outcome !== "issue_found") return { error: "The field team has not reported an issue." };

  const { data: existingReport } = await admin
    .from("inspection_issue_reports")
    .select("id")
    .eq("field_case_id", fieldCase.id)
    .maybeSingle();
  if (existingReport) return { error: "An Inspection Issue Report already exists for this inspection." };

  let proposalId: string | null = null;
  if (profitable) {
    const { data: proposal, error: proposalError } = await admin
      .from("vehicle_price_proposals")
      .insert({
        vehicle_id: tx.vehicle_id,
        transaction_id: tx.id,
        proposal_kind: "revised_ceiling",
        proposed_amount: newCeiling,
        proposer_id: actor.userId,
        decision: "pending",
        notes: `Inspection issue: ${fieldCase.issue_description}. Recalculated price ${peso(recalculated)}.`,
      })
      .select("id")
      .single();
    if (proposalError) return { error: proposalError.message };
    proposalId = proposal.id;
  }

  const { error: reportError } = await admin.from("inspection_issue_reports").insert({
    transaction_id: tx.id,
    field_case_id: fieldCase.id,
    issue_found: fieldCase.issue_description,
    repair_estimate: fieldCase.repair_estimate,
    is_profitable: profitable,
    profitability_reason: parsed.data.profitability_reason,
    recalculated_price: recalculated,
    new_ceiling: newCeiling,
    proposal_id: proposalId,
    created_by: actor.userId,
  });
  if (reportError) return { error: reportError.message };

  const error = await moveSellTransaction(
    admin,
    tx,
    actor.userId,
    profitable
      ? { current_state: "under_review", flow_status: "pending_ceo_approval", review_due_at: reviewDueAt() }
      : { current_state: "cancelled", flag: "cancelled_unprofitable" },
    profitable
      ? `Revised ceiling of ${peso(newCeiling)} sent to the CEO after an inspection issue`
      : `Cancelled: not profitable after inspection. ${parsed.data.profitability_reason}`,
  );
  if (error) return { error };

  if (profitable) {
    await notify(
      admin,
      { role: "ceo" },
      {
        kind: "ceiling_proposed",
        title: "Revised ceiling awaiting approval",
        body: `An inspection found an issue. A revised ceiling of ${peso(newCeiling)} awaits your decision.`,
        transactionId: tx.id,
      },
    );
  } else {
    // Q10 default: the field team tells the seller on-site; the seller also gets it in writing.
    for (const recipient of [tx.customer_id, fieldCase.assigned_confidential_informant, fieldCase.mechanic_id]) {
      if (!recipient) continue;
      await notify(
        admin,
        { userId: recipient },
        {
          kind: "sell_offer_cancelled",
          title: "GCE will no longer buy this vehicle",
          body: "After the inspection, GCE will not proceed with the purchase.",
          transactionId: tx.id,
        },
      );
    }
  }
  return done(tx.id);
}

// Selling step 9: record whether the seller accepts the CEO-approved revised price.
export async function recordSellerResponse(formData: FormData): Promise<SellActionResult> {
  const actor = await marketingSpecialist();
  if ("error" in actor) return actor;

  const parsed = z
    .object({ transaction_id: transactionIdSchema, response: z.enum(["agreed", "refused"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid seller response." };

  const admin = createAdminClient();
  const tx = await loadSellTransaction(admin, parsed.data.transaction_id);
  if (!tx) return { error: "Sell transaction not found." };
  if (tx.current_state !== "approved") return { error: "The CEO has not approved a revised price for this offer." };

  const { data: report } = await admin
    .from("inspection_issue_reports")
    .select("id, recalculated_price, seller_response, vehicle_price_proposals(decision)")
    .eq("transaction_id", tx.id)
    .eq("is_profitable", true)
    .maybeSingle();
  const proposalDecision = (report?.vehicle_price_proposals as { decision?: string } | null)?.decision;
  if (!report || proposalDecision !== "approved") return { error: "No approved revised price to present." };
  if (report.seller_response) return { error: "The seller's answer is already recorded." };

  const agreed = parsed.data.response === "agreed";
  const now = new Date().toISOString();
  const { error: reportError } = await admin
    .from("inspection_issue_reports")
    .update({ seller_response: parsed.data.response, seller_response_at: now })
    .eq("id", report.id);
  if (reportError) return { error: reportError.message };

  if (agreed) {
    const { error: sellError } = await admin
      .from("sell_details")
      .update({ agreed_price: report.recalculated_price, cleared_for_payment_at: now })
      .eq("transaction_id", tx.id);
    if (sellError) return { error: sellError.message };
    await admin.from("transaction_status_history").insert({
      transaction_id: tx.id,
      from_state: tx.current_state,
      to_state: tx.current_state,
      actor_id: actor.userId,
      reason: `Seller agreed to the revised price of ${peso(report.recalculated_price)}; cleared for payment`,
    });
    for (const role of ["account_manager", "ceo"]) {
      await notify(
        admin,
        { role },
        {
          kind: "sell_ready_for_payment",
          title: "Seller's car cleared for payment",
          body: `The seller agreed to ${peso(report.recalculated_price)}. Request the purchase funds in Finance.`,
          transactionId: tx.id,
        },
      );
    }
    return done(tx.id);
  }

  const error = await moveSellTransaction(
    admin,
    tx,
    actor.userId,
    { current_state: "cancelled", flag: "seller_refused" },
    "Seller refused the revised price",
  );
  if (error) return { error };
  return done(tx.id);
}
