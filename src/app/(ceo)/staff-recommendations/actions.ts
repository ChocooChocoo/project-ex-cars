"use server";

import { createServerSupabase } from "@/lib/supabase/server";

export async function getPricingTrends() {
  const supabase = await createServerSupabase();
  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("make, current_price, created_at")
    .not("current_price", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { error: error.message };

  const makePriceMap = new Map<string, { total: number; count: number }>();
  for (const v of vehicles ?? []) {
    const price = v.current_price as number;
    const make = (v.make as string) || "Unknown";
    const existing = makePriceMap.get(make) ?? { total: 0, count: 0 };
    existing.total += price;
    existing.count += 1;
    makePriceMap.set(make, existing);
  }

  const byMake = Array.from(makePriceMap.entries())
    .map(([make, { total, count }]) => ({ make, avgPrice: Math.round(total / count) }))
    .sort((a, b) => b.avgPrice - a.avgPrice);

  const byMonth = new Map<string, { total: number; count: number }>();
  for (const v of vehicles ?? []) {
    const d = new Date(v.created_at as string);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = byMonth.get(key) ?? { total: 0, count: 0 };
    existing.total += (v.current_price as number) ?? 0;
    existing.count += 1;
    byMonth.set(key, existing);
  }

  const timeline = Array.from(byMonth.entries())
    .map(([month, { total, count }]) => ({ month, avgPrice: Math.round(total / count) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return { success: true, byMake, timeline };
}

export async function getStockTurnover() {
  const supabase = await createServerSupabase();

  const { count: total } = await supabase.from("vehicles").select("*", { count: "exact", head: true });

  const { count: available } = await supabase
    .from("vehicles")
    .select("*", { count: "exact", head: true })
    .eq("listing_state", "available");

  const { count: sold } = await supabase
    .from("vehicles")
    .select("*", { count: "exact", head: true })
    .eq("listing_state", "sold");

  const { count: reserved } = await supabase
    .from("vehicles")
    .select("*", { count: "exact", head: true })
    .eq("listing_state", "reserved");

  const { data: byCondition } = await supabase
    .from("vehicles")
    .select("condition, count:id")
    .not("condition", "is", null);
  const conditionGroups = new Map<string, number>();
  for (const item of byCondition ?? []) {
    const cond = (item.condition as string) ?? "unknown";
    conditionGroups.set(cond, (conditionGroups.get(cond) ?? 0) + 1);
  }

  // Time-based turnover: sold in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: soldLast30 } = await supabase
    .from("vehicles")
    .select("*", { count: "exact", head: true })
    .eq("listing_state", "sold")
    .gte("updated_at", thirtyDaysAgo);

  // Average days to sell for completed transactions
  const { data: completedTxs } = await supabase
    .from("transactions")
    .select("opened_at, completed_at")
    .eq("current_state", "completed")
    .eq("transaction_kind", "buy")
    .not("completed_at", "is", null);
  let avgDaysToSell = 0;
  if (completedTxs && completedTxs.length > 0) {
    const totalDays = completedTxs.reduce((sum, tx) => {
      const open = new Date(tx.opened_at as string).getTime();
      const complete = new Date(tx.completed_at as string).getTime();
      return sum + (complete - open) / (1000 * 60 * 60 * 24);
    }, 0);
    avgDaysToSell = Math.round(totalDays / completedTxs.length);
  }

  return {
    success: true,
    total: total ?? 0,
    available: available ?? 0,
    sold: sold ?? 0,
    reserved: reserved ?? 0,
    soldLast30: soldLast30 ?? 0,
    avgDaysToSell,
    byCondition: Array.from(conditionGroups.entries()).map(([condition, count]) => ({ condition, count })),
  };
}

export async function getBuyingPatterns() {
  const supabase = await createServerSupabase();

  // Derive buying patterns from completed buy transactions (not just inventory).
  const { data: transactions } = await supabase
    .from("transactions")
    .select("vehicle_id")
    .eq("current_state", "completed")
    .eq("transaction_kind", "buy")
    .not("vehicle_id", "is", null);

  const soldVehicleIds = (transactions ?? []).map((t) => t.vehicle_id as string);

  const makeCount = new Map<string, number>();
  const bodyTypeCount = new Map<string, number>();
  const fuelCount = new Map<string, number>();
  const priceRanges = { budget: 0, mid: 0, premium: 0, luxury: 0 };

  if (soldVehicleIds.length > 0) {
    const { data: soldVehicles } = await supabase
      .from("vehicles")
      .select("make, model, body_type, fuel_type, condition, current_price")
      .in("id", soldVehicleIds);

    for (const v of soldVehicles ?? []) {
      increment(makeCount, v.make as string);
      increment(bodyTypeCount, v.body_type as string);
      increment(fuelCount, v.fuel_type as string);

      const price = (v.current_price as number) ?? 0;
      if (price <= 300000) priceRanges.budget++;
      else if (price <= 800000) priceRanges.mid++;
      else if (price <= 2000000) priceRanges.premium++;
      else priceRanges.luxury++;
    }
  }

  return {
    success: true,
    topMakes: topN(makeCount, 8),
    bodyTypes: Array.from(bodyTypeCount.entries()).map(([type, count]) => ({ type, count })),
    fuelTypes: Array.from(fuelCount.entries()).map(([type, count]) => ({ type, count })),
    priceRanges: [
      { range: "Budget (≤₱300k)", count: priceRanges.budget },
      { range: "Mid (₱300k–₱800k)", count: priceRanges.mid },
      { range: "Premium (₱800k–₱2M)", count: priceRanges.premium },
      { range: "Luxury (>₱2M)", count: priceRanges.luxury },
    ],
  };
}

export async function getMarketInsights() {
  const supabase = await createServerSupabase();

  const { count: totalVehicles } = await supabase.from("vehicles").select("*", { count: "exact", head: true });
  const { count: availableVehicles } = await supabase
    .from("vehicles")
    .select("*", { count: "exact", head: true })
    .eq("listing_state", "available");
  const { count: totalInquiries } = await supabase.from("inquiries").select("*", { count: "exact", head: true });
  const { count: totalFavourites } = await supabase.from("favourites").select("*", { count: "exact", head: true });

  const { data: priceData } = await supabase
    .from("vehicles")
    .select("current_price")
    .not("current_price", "is", null)
    .eq("listing_state", "available");

  let avgPrice = 0;
  if (priceData && priceData.length > 0) {
    const total = priceData.reduce((sum, v) => sum + ((v.current_price as number) ?? 0), 0);
    avgPrice = Math.round(total / priceData.length);
  }

  const { data: recent } = await supabase
    .from("vehicles")
    .select("id")
    .eq("listing_state", "available")
    .order("created_at", { ascending: false })
    .limit(10);

  const recentIds = (recent ?? []).map((r) => r.id);
  const recentInquiryCount =
    recentIds.length > 0
      ? await supabase.from("inquiries").select("*", { count: "exact", head: true }).in("vehicle_id", recentIds)
      : { count: 0 };

  return {
    success: true,
    totalVehicles: totalVehicles ?? 0,
    availableVehicles: availableVehicles ?? 0,
    totalInquiries: totalInquiries ?? 0,
    totalFavourites: totalFavourites ?? 0,
    avgPrice,
    recentListingInquiries: recentInquiryCount.count ?? 0,
  };
}

export async function getAccuracyData() {
  const supabase = await createServerSupabase();

  const { count: totalRuns } = await supabase.from("recommendation_runs").select("*", { count: "exact", head: true });

  const { data: feedback } = await supabase.from("recommendation_feedback").select("helpful_state");

  const helpful = feedback?.filter((f) => f.helpful_state === "helpful").length ?? 0;
  const notHelpful = feedback?.filter((f) => f.helpful_state === "not_helpful").length ?? 0;

  const { data: results } = await supabase.from("recommendation_results").select("vehicle_id");

  const topVehicleIds = new Set<string>();
  if (results) {
    const counts = new Map<string, number>();
    for (const r of results) {
      counts.set(r.vehicle_id, (counts.get(r.vehicle_id) ?? 0) + 1);
    }
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [id] of top) topVehicleIds.add(id);
  }

  const { data: topVehicles } = await supabase
    .from("vehicles")
    .select("make, model, year")
    .in("id", Array.from(topVehicleIds));

  return {
    success: true,
    totalRuns: totalRuns ?? 0,
    helpful,
    notHelpful,
    accuracy: helpful + notHelpful > 0 ? Math.round((helpful / (helpful + notHelpful)) * 100) : 0,
    topRecommended: topVehicles ?? [],
  };
}

function increment(map: Map<string, number>, key: string | null | undefined) {
  const k = key ?? "Other";
  map.set(k, (map.get(k) ?? 0) + 1);
}

function topN(map: Map<string, number>, n: number) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}
