"use server";

import { revalidatePath } from "next/cache";

import { rankVehicles, type VehicleInput } from "@/lib/recommendations/engine";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const CRITERIA_VERSION = "1.0";

export async function runRecommendation(budget: number, _preferences: Record<string, string>) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: vehicles, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id, current_price, condition, mileage, fuel_type, make, model, body_type")
    .eq("listing_state", "available");

  if (vehicleError) return { error: vehicleError.message };
  if (!vehicles || vehicles.length === 0) return { error: "No available vehicles found." };

  const vehicleIds = vehicles.map((v) => v.id);

  const [{ data: inspections }, { data: favourites }, { data: inquiries }] = await Promise.all([
    supabase.from("vehicle_inspections").select("vehicle_id, condition_score").in("vehicle_id", vehicleIds),
    supabase.from("favourites").select("vehicle_id").in("vehicle_id", vehicleIds),
    supabase.from("inquiries").select("vehicle_id").in("vehicle_id", vehicleIds),
  ]);

  const inspectionMap = new Map<string, number>();
  for (const insp of inspections ?? []) {
    if (insp.condition_score !== null) {
      const existing = inspectionMap.get(insp.vehicle_id);
      if (existing === undefined || insp.condition_score > existing) {
        inspectionMap.set(insp.vehicle_id, insp.condition_score);
      }
    }
  }

  const favouriteCounter = new Map<string, number>();
  for (const f of favourites ?? []) {
    favouriteCounter.set(f.vehicle_id, (favouriteCounter.get(f.vehicle_id) ?? 0) + 1);
  }

  const inquiryCounter = new Map<string, number>();
  for (const i of inquiries ?? []) {
    inquiryCounter.set(i.vehicle_id, (inquiryCounter.get(i.vehicle_id) ?? 0) + 1);
  }

  const vehicleInputs: VehicleInput[] = vehicles.map((v) => ({
    id: v.id,
    current_price: v.current_price as number | null,
    condition: v.condition as string | null,
    mileage: v.mileage as number | null,
    fuel_type: v.fuel_type as string | null,
    make: v.make as string | null,
    model: v.model as string | null,
    body_type: v.body_type as string | null,
    inspection_score: inspectionMap.get(v.id) ?? null,
    favourite_count: favouriteCounter.get(v.id) ?? 0,
    inquiry_count: inquiryCounter.get(v.id) ?? 0,
  }));

  const scored = rankVehicles(vehicleInputs, budget);

  const { data: run, error: runError } = await supabase
    .from("recommendation_runs")
    .insert({
      customer_id: user.id,
      budget,
      stated_preferences: JSON.stringify(_preferences),
      criteria_version: CRITERIA_VERSION,
    })
    .select()
    .single();

  if (runError) return { error: runError.message };

  const resultRows = scored.map((s) => ({
    run_id: run.id,
    vehicle_id: s.vehicleId,
    budget_score: s.budgetScore,
    condition_score: s.conditionScore,
    fuel_score: s.fuelScore,
    demand_score: s.demandScore,
    mileage_score: s.mileageScore,
    total_score: s.totalScore,
    rank: s.rank,
  }));

  const { error: resultsError } = await supabase.from("recommendation_results").insert(resultRows);
  if (resultsError) return { error: resultsError.message };

  revalidatePath("/recommendations");

  return { success: true, runId: run.id, scored };
}

export async function getRecommendationRun(runId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: run, error: runError } = await supabase
    .from("recommendation_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (runError) return { error: runError.message };
  if (run.customer_id !== user.id) return { error: "Access denied" };

  const { data: results, error: resultsError } = await supabase
    .from("recommendation_results")
    .select("*")
    .eq("run_id", runId)
    .order("rank", { ascending: true });

  if (resultsError) return { error: resultsError.message };

  return { success: true, run, results };
}

export async function getCustomerRuns() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: runs, error } = await supabase
    .from("recommendation_runs")
    .select("*")
    .eq("customer_id", user.id)
    .order("run_date", { ascending: false });

  if (error) return { error: error.message };

  return { success: true, runs };
}

export async function submitFeedback(runId: string, selectedVehicleId: string, helpful: boolean, outcome?: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: run } = await supabase.from("recommendation_runs").select("customer_id").eq("id", runId).single();
  if (!run || run.customer_id !== user.id) return { error: "Access denied" };

  const { error } = await supabase.from("recommendation_feedback").insert({
    run_id: runId,
    selected_vehicle_id: selectedVehicleId,
    helpful_state: helpful ? "helpful" : "not_helpful",
    outcome: outcome ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/recommendations");

  return { success: true };
}
