"use server";

import { revalidatePath } from "next/cache";

import { errorMessage } from "@/lib/api/errors";
import { apiGet, apiWrite } from "@/lib/api/server";
import type { ScoredVehicle } from "@/lib/recommendations/engine";
import { statedPreferencesSchema } from "@/lib/validation/recommendations";

// Laravel ranks the available cars (RecommendationService, a port of src/lib/recommendations/engine.ts) and
// stores the run for the signed-in user; these actions keep the result shapes the components already use.

export async function runRecommendation(budget: number, preferences: Record<string, string>) {
  const parsed = statedPreferencesSchema.safeParse(preferences);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Fill in the required preferences." };
  try {
    const { data } = await apiWrite<{ runId: string; scored: ScoredVehicle[] }>("POST", "/api/v1/recommendations", {
      budget,
      preferences,
    });
    revalidatePath("/recommendations");
    return { success: true, runId: data.runId, scored: data.scored };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

interface RecommendationRunData {
  run: Record<string, unknown>;
  results: Record<string, unknown>[];
  vehicles: Record<string, unknown>[];
}

export async function getRecommendationRun(
  runId: string,
): Promise<({ success: true; error?: undefined } & RecommendationRunData) | { success?: undefined; error: string }> {
  try {
    const { data } = await apiGet<RecommendationRunData>(`/api/v1/recommendations/${encodeURIComponent(runId)}`);
    return { success: true, ...data };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function getCustomerRuns() {
  try {
    const { data: runs } = await apiGet<Record<string, unknown>[]>("/api/v1/recommendations");
    return { success: true, runs };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function submitFeedback(runId: string, selectedVehicleId: string, helpful: boolean, outcome?: string) {
  try {
    await apiWrite("POST", `/api/v1/recommendations/${encodeURIComponent(runId)}/feedback`, {
      selected_vehicle_id: selectedVehicleId,
      helpful,
      outcome: outcome ?? null,
    });
    revalidatePath("/recommendations");
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
