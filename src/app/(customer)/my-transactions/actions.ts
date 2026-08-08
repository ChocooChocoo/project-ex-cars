"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabase } from "@/lib/supabase/server";

export async function createBuyTransaction(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const vehicleId = formData.get("vehicle_id") as string;

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

  const transactionId = formData.get("transaction_id") as string;
  const paymentMethod = formData.get("payment_method") as string;
  const finalPrice = formData.get("final_price") as string;
  const arrangementKind = formData.get("arrangement_kind") as string;
  const schedule = formData.get("schedule") as string;
  const location = formData.get("location") as string;
  const notes = formData.get("notes") as string | null;

  const { error } = await supabase.from("purchase_details").upsert({
    transaction_id: transactionId,
    payment_method: paymentMethod,
    final_price: finalPrice ? Number.parseFloat(finalPrice) : null,
    arrangement_kind: arrangementKind || null,
  });

  if (error) return { error: error.message };

  // Create viewing arrangement if schedule provided.
  if (schedule) {
    const { error: arrError } = await supabase.from("viewing_arrangements").insert({
      inquiry_id: null, // nullable — linked via purchase_transaction_id
      purchase_transaction_id: transactionId,
      arrangement_kind: arrangementKind || "gce_visit",
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

  const make = formData.get("make") as string;
  const model = formData.get("model") as string;
  const year = formData.get("year") as string;
  const mileage = formData.get("mileage") as string;
  const condition = formData.get("condition") as string;
  const offeredAmount = formData.get("offered_amount") as string;
  const description = formData.get("description") as string | null;

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
    offered_amount: offeredAmount ? Number.parseFloat(offeredAmount) : null,
  });

  if (detailError) return { error: detailError.message };

  // Create a draft vehicle record for the offered vehicle.
  const stockCode = `SELL-${make?.slice(0, 3).toUpperCase() ?? "XXX"}-${Date.now().toString(36).toUpperCase()}`;
  const { error: vehicleError } = await supabase.from("vehicles").insert({
    stock_code: stockCode,
    make,
    model,
    year: year ? Number.parseInt(year) : null,
    mileage: mileage ? Number.parseInt(mileage) : null,
    condition,
    description,
    listing_state: "draft",
  });

  if (vehicleError) return { error: vehicleError.message };

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
    requested_make: formData.get("requested_make") as string,
    requested_model: formData.get("requested_model") as string,
    year_min: (formData.get("year_min") as string) ? Number.parseInt(formData.get("year_min") as string) : null,
    year_max: (formData.get("year_max") as string) ? Number.parseInt(formData.get("year_max") as string) : null,
    budget: (formData.get("budget") as string) ? Number.parseFloat(formData.get("budget") as string) : null,
    other_preferences: (formData.get("other_preferences") as string) || null,
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
