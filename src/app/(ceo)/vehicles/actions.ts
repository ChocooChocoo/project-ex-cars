"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/(auth)/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export async function createVehicle(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const data = Object.fromEntries(formData) as Record<string, string>;
  const price = data.current_price ? Number.parseFloat(data.current_price) : null;
  const mileage = data.mileage ? Number.parseInt(data.mileage, 10) : null;
  const year = Number.parseInt(data.year, 10);

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .insert({
      stock_code: data.stock_code,
      vin: data.vin || null,
      make: data.make,
      model: data.model,
      year,
      condition: data.condition,
      mileage,
      fuel_type: data.fuel_type || null,
      transmission: data.transmission || null,
      exterior_color: data.exterior_color || null,
      interior_color: data.interior_color || null,
      body_type: data.body_type || null,
      engine: data.engine || null,
      description: data.description || null,
      current_price: price,
      pricing_type: data.pricing_type || "negotiable",
      warranty_details: data.warranty_details || null,
      offer_details: data.offer_details || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/vehicles");
  return { success: true, id: vehicle.id };
}

export async function updateVehicle(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const data = Object.fromEntries(formData) as Record<string, string>;
  const id = data.id;
  const price = data.current_price ? Number.parseFloat(data.current_price) : null;
  const mileage = data.mileage ? Number.parseInt(data.mileage, 10) : null;
  const year = Number.parseInt(data.year, 10);

  const { error } = await supabase
    .from("vehicles")
    .update({
      stock_code: data.stock_code,
      vin: data.vin || null,
      make: data.make,
      model: data.model,
      year,
      condition: data.condition,
      mileage,
      fuel_type: data.fuel_type || null,
      transmission: data.transmission || null,
      exterior_color: data.exterior_color || null,
      interior_color: data.interior_color || null,
      body_type: data.body_type || null,
      engine: data.engine || null,
      description: data.description || null,
      current_price: price,
      pricing_type: data.pricing_type || "negotiable",
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
  const supabase = await createServerSupabase();
  const id = formData.get("id") as string;

  const { error } = await supabase
    .from("vehicles")
    .update({ listing_state: "available", posted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/vehicles");
  return { success: true };
}

export async function proposePrice(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const vehicleId = formData.get("vehicle_id") as string;
  const amount = Number.parseFloat(formData.get("proposed_amount") as string);
  const notes = formData.get("notes") as string | null;

  const { error } = await supabase.from("vehicle_price_proposals").insert({
    vehicle_id: vehicleId,
    proposed_amount: amount,
    proposer_id: user.user.id,
    notes,
  });

  if (error) return { error: error.message };

  await supabase.from("vehicles").update({ listing_state: "awaiting_price_approval" }).eq("id", vehicleId);

  revalidatePath("/dashboard/vehicles");
  return { success: true };
}

export async function approvePrice(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const proposalId = formData.get("proposal_id") as string;
  const decision = formData.get("decision") as string;
  const vehicleId = formData.get("vehicle_id") as string;

  const admin = createAdminClient();

  const { error } = await admin
    .from("vehicle_price_proposals")
    .update({
      decision,
      decider_id: user.user.id,
      decision_date: new Date().toISOString(),
    })
    .eq("id", proposalId);

  if (error) return { error: error.message };

  if (decision === "approved") {
    const { data: proposal } = await supabase
      .from("vehicle_price_proposals")
      .select("proposed_amount")
      .eq("id", proposalId)
      .single();

    if (proposal) {
      await admin.from("vehicles").update({ current_price: proposal.proposed_amount }).eq("id", vehicleId);
    }
  }

  await admin
    .from("vehicles")
    .update({ listing_state: decision === "approved" ? "available" : "draft" })
    .eq("id", vehicleId);

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

export async function toggleFavourite(vehicleId: string) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("favourites")
    .select("id")
    .eq("customer_id", user.user.id)
    .eq("vehicle_id", vehicleId)
    .single();

  if (existing) {
    await supabase.from("favourites").delete().eq("id", existing.id);
    return { success: true, favourited: false };
  }

  await supabase.from("favourites").insert({
    customer_id: user.user.id,
    vehicle_id: vehicleId,
  });

  return { success: true, favourited: true };
}

export async function createInspection(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const vehicleId = formData.get("vehicle_id") as string;
  const score = formData.get("condition_score") ? Number.parseInt(formData.get("condition_score") as string, 10) : null;

  const { data: inspection, error } = await supabase
    .from("vehicle_inspections")
    .insert({
      vehicle_id: vehicleId,
      mechanic_id: user.user.id,
      condition_score: score,
      findings: formData.get("findings") as string | null,
      recommendation: formData.get("recommendation") as string | null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/inspections");
  return { success: true, id: inspection.id };
}

export async function submitChecklistAnswer(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const inspectionId = formData.get("inspection_id") as string;
  const entryId = formData.get("checklist_entry_id") as string;
  const status = formData.get("status") as string;
  const notes = formData.get("notes") as string | null;

  const { data: result, error } = await supabase
    .from("inspection_checklist_results")
    .upsert(
      {
        inspection_id: inspectionId,
        checklist_entry_id: entryId,
        status,
        notes,
      },
      { onConflict: "inspection_id,checklist_entry_id" },
    )
    .select()
    .single();

  if (error) return { error: error.message };

  if (status === "for_repair" || status === "for_replacement") {
    const itemName = formData.get("item_name") as string;
    if (itemName) {
      const cost = formData.get("estimated_cost") ? Number.parseFloat(formData.get("estimated_cost") as string) : null;
      await supabase.from("part_replacements").upsert(
        {
          checklist_answer_id: result.id,
          item_name: itemName,
          brand: (formData.get("brand") as string) || null,
          estimated_cost: cost,
        },
        { onConflict: "checklist_answer_id" },
      );
    }
  }

  revalidatePath(`/dashboard/inspections/${inspectionId}`);
  return { success: true };
}

export async function createContentItem(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const data = Object.fromEntries(formData) as Record<string, string>;

  const { error } = await supabase.from("content_items").insert({
    content_kind: data.content_kind,
    vehicle_id: data.vehicle_id || null,
    title: data.title,
    body: data.body || null,
    author_id: user.user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/content");
  return { success: true };
}

export async function publishContent(id: string) {
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("content_items")
    .update({ publication_state: "published", published_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/content");
  return { success: true };
}

export async function archiveVehicle(vehicleId: string) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo", "sales_manager", "marketing_specialist"].includes(role)) {
    return { error: "Not authorized" };
  }

  const { error } = await supabase.from("vehicles").update({ listing_state: "archived" }).eq("id", vehicleId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/vehicles");
  return { success: true };
}

export async function deleteVehicle(vehicleId: string) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !["ceo"].includes(role)) {
    return { error: "Not authorized" };
  }

  const { error } = await supabase.from("vehicles").delete().eq("id", vehicleId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/vehicles");
  return { success: true };
}
