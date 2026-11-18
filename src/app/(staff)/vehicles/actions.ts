"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/lib/auth/server-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CEILING_PROPOSAL_KINDS } from "@/lib/transactions/sell-flow";
import { applyCeilingDecision } from "@/lib/transactions/sell-flow-server";
import { checklistAnswerSchema, inspectionSchema, priceProposalSchema, vehicleSchema } from "@/lib/validation/vehicles";
import { nextStockCode } from "@/lib/vehicles/stock-code";

export async function createVehicle(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "marketing_specialist") {
    return { error: "Not authorized" };
  }

  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid vehicle details." };
  }

  const data = parsed.data;

  // T06: the server numbers the car (the form only previews the code). One retry covers two Marketing
  // Specialists saving at the same moment; the UNIQUE constraint rejects the loser of the race.
  const insertVehicle = async () => {
    const { data: codes } = await createAdminClient()
      .from("vehicles")
      .select("stock_code")
      .ilike("stock_code", "GCE-%");
    return supabase
      .from("vehicles")
      .insert({
        stock_code: nextStockCode((codes ?? []).map((row) => row.stock_code as string)),
        vin: data.vin || null,
        plate_number: data.plate_number || null,
        engine_number: data.engine_number || null,
        chassis_number: data.chassis_number || null,
        make: data.make,
        model: data.model,
        year: data.year,
        condition: data.condition,
        mileage: data.mileage ?? null,
        fuel_type: data.fuel_type || null,
        transmission: data.transmission || null,
        exterior_color: data.exterior_color || null,
        interior_color: data.interior_color || null,
        body_type: data.body_type || null,
        purpose: data.purpose || null,
        engine: data.engine || null,
        description: data.description || null,
        current_price: data.current_price ?? null,
        // T11: blank means "use GCE's global markup", stored as NULL.
        financing_markup_pct:
          data.financing_markup_pct === "" || data.financing_markup_pct === undefined
            ? null
            : data.financing_markup_pct,
        warranty_details: data.warranty_details || null,
        offer_details: data.offer_details || null,
      })
      .select()
      .single();
  };
  let { data: vehicle, error } = await insertVehicle();
  if (error?.code === "23505" && error.message.includes("stock_code")) {
    ({ data: vehicle, error } = await insertVehicle());
  }

  if (error) return { error: error.message };

  revalidatePath("/dashboard/vehicles");
  return { success: true, id: vehicle.id };
}

export async function updateVehicle(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "marketing_specialist") {
    return { error: "Not authorized" };
  }

  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid vehicle details." };
  }

  const data = parsed.data;
  const id = formData.get("id") as string;

  const { error } = await supabase
    .from("vehicles")
    .update({
      vin: data.vin || null,
      plate_number: data.plate_number || null,
      engine_number: data.engine_number || null,
      chassis_number: data.chassis_number || null,
      make: data.make,
      model: data.model,
      year: data.year,
      condition: data.condition,
      mileage: data.mileage ?? null,
      fuel_type: data.fuel_type || null,
      transmission: data.transmission || null,
      exterior_color: data.exterior_color || null,
      interior_color: data.interior_color || null,
      body_type: data.body_type || null,
      purpose: data.purpose || null,
      engine: data.engine || null,
      description: data.description || null,
      current_price: data.current_price ?? null,
      // T11: blank means "use GCE's global markup", stored as NULL.
      financing_markup_pct:
        data.financing_markup_pct === "" || data.financing_markup_pct === undefined ? null : data.financing_markup_pct,
      warranty_details: data.warranty_details || null,
      offer_details: data.offer_details || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/vehicles");
  revalidatePath(`/dashboard/vehicles/${id}`);
  return { success: true };
}

export async function publishVehicle(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "marketing_specialist") {
    return { error: "Not authorized" };
  }

  const id = formData.get("id") as string;

  // Require an approved price proposal before publishing.
  const { data: approved } = await supabase
    .from("vehicle_price_proposals")
    .select("id")
    .eq("vehicle_id", id)
    .eq("decision", "approved")
    .single();

  if (!approved) {
    return { error: "Vehicle must have an approved price proposal before publishing." };
  }

  const { error } = await supabase
    .from("vehicles")
    .update({ listing_state: "available", posted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/vehicles");
  return { success: true };
}

export async function proposePrice(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "marketing_specialist") {
    return { error: "Not authorized" };
  }

  const parsed = priceProposalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid price proposal." };
  }

  // §6 steps 36–39: a repossessed car is repriced only after its reconditioning is finished and its
  // papers are re-processed; that proposal is a "reprice".
  const { data: jobs } = await supabase
    .from("reconditioning_jobs")
    .select("state, papers_processed_at, completed_at")
    .eq("vehicle_id", parsed.data.vehicle_id)
    .order("created_at", { ascending: false })
    .limit(1);
  const job = jobs?.[0];
  if (job && job.state !== "completed") return { error: "Finish the car's reconditioning before repricing it." };
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("listing_state")
    .eq("id", parsed.data.vehicle_id)
    .maybeSingle();
  const reprice = Boolean(job) && vehicle?.listing_state === "repairing";
  if (reprice && !job?.papers_processed_at) return { error: "The Sales Manager must re-process the papers first." };
  const proposalKind = reprice ? "reprice" : "selling_price";

  const { data: existingProposal } = await supabase
    .from("vehicle_price_proposals")
    .select("id")
    .eq("vehicle_id", parsed.data.vehicle_id)
    .eq("proposal_kind", proposalKind)
    .eq("decision", "pending")
    .maybeSingle();
  if (existingProposal) return { error: "This vehicle already has a pending price proposal." };

  const { error } = await supabase.from("vehicle_price_proposals").insert({
    vehicle_id: parsed.data.vehicle_id,
    proposed_amount: parsed.data.proposed_amount,
    proposer_id: user.user.id,
    decision: "pending",
    proposal_kind: proposalKind,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: error.message };

  const { error: vehicleError } = await supabase
    .from("vehicles")
    .update({ listing_state: "awaiting_price_approval" })
    .eq("id", parsed.data.vehicle_id);
  if (vehicleError) return { error: vehicleError.message };

  revalidatePath("/dashboard/vehicles");
  return { success: true };
}

export async function approvePrice(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "ceo") {
    return { error: "Only the CEO can approve or reject price proposals." };
  }

  const proposalId = formData.get("proposal_id") as string;
  const decision = formData.get("decision") as string;
  if (!["approved", "rejected"].includes(decision)) return { error: "Invalid proposal decision." };
  // T06: Request Revision sends the price back to the Marketing Specialist with the CEO's reason.
  const decisionNotes =
    String(formData.get("decision_notes") ?? "")
      .trim()
      .slice(0, 1000) || null;

  const admin = createAdminClient();

  const { data: proposal, error: proposalError } = await admin
    .from("vehicle_price_proposals")
    .select("vehicle_id, proposed_amount, decision, proposal_kind, transaction_id, proposer_id")
    .eq("id", proposalId)
    .eq("decision", "pending")
    .maybeSingle();
  if (proposalError) return { error: proposalError.message };
  if (!proposal) return { error: "Price proposal is no longer pending." };

  // Purchase and revised ceilings decide a sell offer, not a listing (D3).
  const isCeiling = (CEILING_PROPOSAL_KINDS as readonly string[]).includes(proposal.proposal_kind);
  // T10: instead of approving or rejecting, the CEO may type the price. For a ceiling it is the limit the
  // Marketing Specialist negotiates within; for a selling price it is the price the car is posted at. The
  // Marketing Specialist's figure stays in the decision notes.
  const setPrice = formData.get("ceiling_amount") ?? formData.get("set_amount");
  let ceilingNote: string | null = null;
  if (decision === "approved" && setPrice !== null && setPrice !== "") {
    const amount = Number(setPrice);
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the price." };
    ceilingNote = `CEO set the ${isCeiling ? "ceiling" : "price"} to ₱${amount.toLocaleString()} (proposed ₱${Number(proposal.proposed_amount).toLocaleString()}).`;
    proposal.proposed_amount = amount;
  }
  if (isCeiling) {
    const ceilingError = await applyCeilingDecision(admin, proposal, decision as "approved" | "rejected", user.user.id);
    if (ceilingError) return { error: ceilingError };
  }

  const vehicleId = proposal.vehicle_id as string;
  const { error } = await admin
    .from("vehicle_price_proposals")
    .update({
      decision,
      decider_id: user.user.id,
      decision_date: new Date().toISOString(),
      decision_notes: [ceilingNote, decisionNotes].filter(Boolean).join(" ") || null,
      ...(ceilingNote ? { proposed_amount: proposal.proposed_amount } : {}),
    })
    .eq("id", proposalId)
    .eq("decision", "pending");

  if (error) return { error: error.message };

  if (!isCeiling) {
    if (decision === "approved") {
      await admin.from("vehicles").update({ current_price: proposal.proposed_amount }).eq("id", vehicleId);
    }

    const { data: current } = await admin.from("vehicles").select("posted_at").eq("id", vehicleId).maybeSingle();

    await admin
      .from("vehicles")
      // §6 step 40: a rejected reprice goes back to the Marketing Specialist; the car stays off the listing.
      // An approved price publishes the car: `available` plus `posted_at`, like publishVehicle. Without
      // `posted_at` a car bought from a seller sorts last in the showroom and shows "Posted —".
      .update({
        listing_state:
          decision === "approved" ? "available" : proposal.proposal_kind === "reprice" ? "repairing" : "draft",
        ...(decision === "approved" && !current?.posted_at ? { posted_at: new Date().toISOString() } : {}),
      })
      .eq("id", vehicleId);

    if (decision === "rejected" && proposal.proposer_id) {
      await admin.from("notifications").insert({
        recipient_id: proposal.proposer_id,
        kind: "price_revision_requested",
        title: "Price revision requested",
        body: decisionNotes ? `The CEO asked for a new price: ${decisionNotes}` : "The CEO asked for a new price.",
        reference_table: "vehicles",
        reference_id: vehicleId,
      });
    }
  }

  await admin.from("audit_events").insert({
    actor_id: user.user.id,
    action: `price_${decision}`,
    record_kind: "vehicle_price_proposal",
    record_id: proposalId,
    summary: `Price proposal ${proposalId} for vehicle ${vehicleId} was ${decision}`,
  });

  revalidatePath("/dashboard/vehicles");
  return { success: true };
}

export async function createInspection(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "mechanic") {
    return { error: "Not authorized" };
  }

  const parsed = inspectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid inspection details." };
  }

  const { data: inspection, error } = await supabase
    .from("vehicle_inspections")
    .insert({
      vehicle_id: parsed.data.vehicle_id,
      mechanic_id: user.user.id,
      condition_score: parsed.data.condition_score ?? null,
      findings: parsed.data.findings || null,
      recommendation: parsed.data.recommendation || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/inspections");
  return { success: true, id: inspection.id };
}

export async function submitChecklistAnswer(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "mechanic") {
    return { error: "Not authorized" };
  }

  const parsed = checklistAnswerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid checklist answer." };
  }

  const inspectionId = formData.get("inspection_id") as string;

  const { data: result, error } = await supabase
    .from("inspection_checklist_results")
    .upsert(
      {
        inspection_id: inspectionId,
        checklist_entry_id: parsed.data.checklist_entry_id,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
      },
      { onConflict: "inspection_id,checklist_entry_id" },
    )
    .select()
    .single();

  if (error) return { error: error.message };

  if (parsed.data.status === "for_repair" || parsed.data.status === "for_replacement") {
    if (parsed.data.item_name) {
      await supabase.from("part_replacements").upsert(
        {
          checklist_answer_id: result.id,
          item_name: parsed.data.item_name,
          brand: parsed.data.brand || null,
          estimated_cost: parsed.data.estimated_cost ?? null,
        },
        { onConflict: "checklist_answer_id" },
      );
    }
  }

  revalidatePath(`/dashboard/inspections/${inspectionId}`);
  return { success: true };
}

export async function archiveVehicle(vehicleId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "marketing_specialist") {
    return { error: "Not authorized" };
  }

  const { data: vehicle } = await supabase.from("vehicles").select("listing_state").eq("id", vehicleId).single();
  if (!vehicle) return { error: "Vehicle not found." };
  if (["reserved", "sold", "awaiting_price_approval"].includes(vehicle.listing_state as string)) {
    return { error: "Reserved, sold, or awaiting-approval vehicles cannot be archived." };
  }

  const { error } = await supabase.from("vehicles").update({ listing_state: "archived" }).eq("id", vehicleId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/vehicles");
  return { success: true };
}
