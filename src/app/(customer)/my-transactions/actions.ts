"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { ACCEPTED_ID_TYPES } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buyDetailsSchema,
  buyTransactionSchema,
  requestCarSchema,
  sellVehicleSchema,
} from "@/lib/validation/transactions";

const uploadPurchaseDocumentSchema = z.object({
  transaction_id: z.string().uuid(),
  document_kind: z.enum(["valid_id", "proof_of_billing"]),
  id_type: z.enum(ACCEPTED_ID_TYPES).optional().or(z.literal("")),
});

export async function uploadPurchaseDocument(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = uploadPurchaseDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid document upload." };
  }
  const { transaction_id: transactionId, document_kind: documentKind, id_type: idType } = parsed.data;

  const file = formData.get("file") as File | null;
  if (!file?.size) return { error: "Select a file to upload." };
  if (documentKind === "valid_id" && !idType) return { error: "Select the ID type." };

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, customer_id, transaction_kind")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx || tx.customer_id !== user.user.id) return { error: "Transaction not found." };
  if (tx.transaction_kind !== "buy") return { error: "Documents can only be uploaded for purchases." };

  const fileExt = file.name.split(".").pop() ?? "bin";
  const storagePath = `${transactionId}/${documentKind}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from("transaction-documents").upload(storagePath, file);
  if (uploadError) return { error: uploadError.message };

  const { error: dbError } = await supabase.from("transaction_documents").insert({
    transaction_id: transactionId,
    document_kind: documentKind,
    id_type: idType || null,
    storage_path: storagePath,
    uploader_id: user.user.id,
    verification_state: "pending",
  });
  if (dbError) return { error: dbError.message };

  revalidatePath(`/my-transactions/${transactionId}`);
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  return { success: true };
}

export async function createBuyTransaction(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = buyTransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid buy request." };
  }

  const vehicleId = parsed.data.vehicle_id;

  // Create the transaction record.
  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      customer_id: user.user.id,
      transaction_kind: "buy",
      vehicle_id: vehicleId,
      current_state: "pending",
      created_by: user.user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Also create the inquiry for chat routing (R-09/R-10 reuse).
  const { error: inquiryError } = await supabase.from("inquiries").insert({
    customer_id: user.user.id,
    vehicle_id: vehicleId,
    intention_kind: "buy_now",
  });

  if (inquiryError) return { error: inquiryError.message };

  // Record initial status history.
  await supabase.from("transaction_status_history").insert({
    transaction_id: transaction.id,
    from_state: "pending",
    to_state: "pending",
    actor_id: user.user.id,
    reason: "Transaction created",
  });

  revalidatePath("/my-transactions");
  revalidatePath("/dashboard/transactions");
  return { success: true, id: transaction.id };
}

export async function saveBuyDetails(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = buyDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid purchase details." };
  }

  const {
    transaction_id: transactionId,
    payment_method,
    final_price,
    arrangement_kind,
    schedule,
    location,
    notes,
  } = parsed.data;

  const { error } = await supabase.from("purchase_details").upsert({
    transaction_id: transactionId,
    payment_method,
    final_price: final_price ?? null,
    arrangement_kind: arrangement_kind || null,
  });

  if (error) return { error: error.message };

  // Create viewing arrangement if schedule provided.
  if (schedule) {
    const { error: arrError } = await supabase.from("viewing_arrangements").insert({
      inquiry_id: null, // nullable — linked via purchase_transaction_id
      purchase_transaction_id: transactionId,
      arrangement_kind: arrangement_kind || "gce_visit",
      schedule: new Date(schedule).toISOString(),
      location: location || null,
      notes,
    });

    if (arrError) return { error: arrError.message };
  }

  revalidatePath(`/my-transactions/${transactionId}`);
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  return { success: true };
}

export async function submitSellVehicle(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = sellVehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid vehicle details." };
  }

  const data = parsed.data;

  // Create the sell transaction.
  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      customer_id: user.user.id,
      transaction_kind: "sell",
      current_state: "pending",
      created_by: user.user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  const { error: detailError } = await supabase.from("sell_details").insert({
    transaction_id: transaction.id,
    offered_amount: data.offered_amount,
  });

  if (detailError) return { error: detailError.message };

  // Create a draft vehicle record for the offered vehicle.
  const stockCode = `SELL-${data.make.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const { data: createdVehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .insert({
      stock_code: stockCode,
      make: data.make,
      model: data.model,
      year: data.year,
      mileage: data.mileage,
      condition: data.condition,
      description: data.description ?? null,
      listing_state: "draft",
    })
    .select("id")
    .single();

  if (vehicleError || !createdVehicle) return { error: vehicleError?.message ?? "Failed to create vehicle" };

  // Link the vehicle back to the transaction.
  await supabase.from("transactions").update({ vehicle_id: createdVehicle.id }).eq("id", transaction.id);

  // Record status history.
  await supabase.from("transaction_status_history").insert({
    transaction_id: transaction.id,
    from_state: "pending",
    to_state: "pending",
    actor_id: user.user.id,
    reason: "Sell transaction created",
  });

  revalidatePath("/my-transactions");
  revalidatePath("/dashboard/transactions");
  return { success: true, id: transaction.id };
}

export async function submitRequestCar(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = requestCarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request details." };
  }

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      customer_id: user.user.id,
      transaction_kind: "request_a_car",
      current_state: "pending",
      created_by: user.user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  const { error: reqError } = await supabase.from("vehicle_requests").insert({
    transaction_id: transaction.id,
    requested_make: parsed.data.requested_make,
    requested_model: parsed.data.requested_model,
    year_min: parsed.data.year_min ?? null,
    year_max: parsed.data.year_max ?? null,
    budget: parsed.data.budget,
    other_preferences: parsed.data.other_preferences || null,
  });

  if (reqError) return { error: reqError.message };

  await supabase.from("transaction_status_history").insert({
    transaction_id: transaction.id,
    from_state: "pending",
    to_state: "pending",
    actor_id: user.user.id,
    reason: "Request-a-Car transaction created",
  });

  revalidatePath("/my-transactions");
  revalidatePath("/dashboard/transactions");
  return { success: true, id: transaction.id };
}

export async function cancelTransaction(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  const reason = (formData.get("reason") as string) || null;

  const { data: tx } = await supabase.from("transactions").select("current_state").eq("id", id).single();

  if (!tx) return { error: "Transaction not found" };

  const currentState = tx.current_state as string;
  if (["completed", "cancelled", "rejected"].includes(currentState)) {
    return { error: "This transaction can no longer be cancelled." };
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      current_state: "cancelled",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("customer_id", user.user.id);

  if (error) return { error: error.message };

  await supabase.from("transaction_status_history").insert({
    transaction_id: id,
    from_state: currentState,
    to_state: "cancelled",
    actor_id: user.user.id,
    reason: reason ?? "Cancelled by customer",
  });

  revalidatePath(`/my-transactions/${id}`);
  revalidatePath("/my-transactions");
  revalidatePath(`/dashboard/transactions/${id}`);
  return { success: true };
}
