"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  checklistAnswerSchema,
  contentItemSchema,
  inspectionSchema,
  priceProposalSchema,
  vehicleSchema,
} from "@/lib/validation/vehicles";

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

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .insert({
      stock_code: data.stock_code,
      vin: data.vin || null,
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
      engine: data.engine || null,
      description: data.description || null,
      current_price: data.current_price ?? null,
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
      stock_code: data.stock_code,
      vin: data.vin || null,
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
      engine: data.engine || null,
      description: data.description || null,
      current_price: data.current_price ?? null,
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

  const { error } = await supabase.from("vehicle_price_proposals").insert({
    vehicle_id: parsed.data.vehicle_id,
    proposed_amount: parsed.data.proposed_amount,
    proposer_id: user.user.id,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: error.message };

  await supabase.from("vehicles").update({ listing_state: "awaiting_price_approval" }).eq("id", parsed.data.vehicle_id);

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

export async function uploadVehicleMedia(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "marketing_specialist") {
    return { error: "Not authorized to upload media" };
  }

  const vehicleId = formData.get("vehicle_id") as string;
  const mediaKind = formData.get("media_kind") as string;
  const file = formData.get("file") as File | null;

  if (!vehicleId || !file || file.size === 0) return { error: "Vehicle and file are required" };
  if (!["photo", "360_view"].includes(mediaKind)) return { error: "Invalid media kind" };

  const fileExt = file.name.split(".").pop() ?? "bin";
  const storagePath = `${vehicleId}/${mediaKind}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from("showroom-media").upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
  });
  if (uploadError) return { error: uploadError.message };

  const { data: maxOrder } = await supabase
    .from("vehicle_media")
    .select("display_order")
    .eq("vehicle_id", vehicleId)
    .eq("media_kind", mediaKind)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: dbError } = await supabase.from("vehicle_media").insert({
    vehicle_id: vehicleId,
    media_kind: mediaKind,
    storage_path: storagePath,
    display_order: ((maxOrder?.display_order as number) ?? -1) + 1,
    public_state: true,
    uploaded_by: user.user.id,
  });
  if (dbError) return { error: dbError.message };

  revalidatePath(`/dashboard/vehicles/${vehicleId}`);
  return { success: true };
}

export async function deleteVehicleMedia(mediaId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "marketing_specialist") {
    return { error: "Not authorized to delete media" };
  }

  const { data: row } = await supabase.from("vehicle_media").select("storage_path").eq("id", mediaId).single();
  if (!row) return { error: "Media not found" };

  const { error: storageError } = await supabase.storage.from("showroom-media").remove([row.storage_path as string]);
  if (storageError) return { error: storageError.message };

  const { error: dbError } = await supabase.from("vehicle_media").delete().eq("id", mediaId);
  if (dbError) return { error: dbError.message };

  revalidatePath("/dashboard/vehicles");
  return { success: true };
}

export async function toggleFavourite(vehicleId: string) {
  const supabase = await createServerSupabaseClient();
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

export async function getFavourites() {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const { data } = await supabase.from("favourites").select("vehicle_id, vehicles(*)").eq("customer_id", user.user.id);

  if (!data) return [];

  return data
    .map((row) => row.vehicles as unknown as Record<string, unknown> | null)
    .filter((v): v is Record<string, unknown> => v !== null);
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

export async function createContentItem(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "marketing_specialist") {
    return { error: "Not authorized" };
  }

  const parsed = contentItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid content item." };
  }

  const { error } = await supabase.from("content_items").insert({
    content_kind: parsed.data.content_kind,
    vehicle_id: parsed.data.vehicle_id || null,
    title: parsed.data.title,
    body: parsed.data.body || null,
    author_id: user.user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/content");
  return { success: true };
}

export async function publishContent(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "marketing_specialist") {
    return { error: "Not authorized" };
  }

  const { error } = await supabase
    .from("content_items")
    .update({ publication_state: "published", published_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/content");
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

  const { error } = await supabase.from("vehicles").update({ listing_state: "archived" }).eq("id", vehicleId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/vehicles");
  return { success: true };
}

export async function deleteVehicle(vehicleId: string) {
  const supabase = await createServerSupabaseClient();
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
