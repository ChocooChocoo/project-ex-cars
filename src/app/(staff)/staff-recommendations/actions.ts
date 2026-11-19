"use client";

import { browserApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { formatCurrency } from "@/lib/utils";

// Phase 7: the six cards share one Laravel read (GET /staff/insights, CEO/AM/SM) and keep their aggregation here.
interface InsightRows {
  vehicles: {
    id: string;
    listing_state: string;
    current_price: number | null;
    posted_at: string | null;
    make: string;
    model: string;
    body_type: string | null;
  }[];
  favourites: { vehicle_id: string }[];
  inquiries: { vehicle_id: string; created_at: string }[];
  completedBuys: { id: string; completed_at: string }[];
  purchases: { transaction_id: string; final_price: number | null }[];
}

let pending: { at: number; rows: Promise<InsightRows> } | null = null;

// One request for the cards that load together; a later visit reads fresh rows.
function insights(): Promise<InsightRows> {
  if (!pending || Date.now() - pending.at > 5_000) {
    const rows = browserApi<InsightRows>("GET", "/api/v1/staff/insights");
    pending = { at: Date.now(), rows };
    rows.catch(() => {
      pending = null;
    });
  }
  return pending.rows;
}

async function load(): Promise<{ data: InsightRows } | { error: string }> {
  try {
    return { data: await insights() };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

const FOUR_WEEKS_MS = 4 * 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

export interface KpiStat {
  label: string;
  value: string;
  previous: string;
  change: number;
  direction: "up" | "down";
  period: string;
}

export interface SalesOverviewPoint {
  period: string;
  units: number;
  revenue: number;
}

export interface TopVehicleCategory {
  name: string;
  share: number;
  color: string;
}

export interface TopVehicleProduct {
  name: string;
  category: string;
  share: string;
  sales: string;
}

export interface AllocationItem {
  key: string;
  account: string;
  amount: number;
  percentage: number;
  fill: string;
}

export interface MarketActivityPoint {
  date: string;
  timestamp: number;
  inquiries: number;
  sales: number;
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function changePercent(current: number, previous: number) {
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatCount(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

const ALLOCATION_COLORS = ["var(--chart-2)", "var(--chart-4)", "var(--chart-1)", "var(--chart-3)"] as const;

export async function getRecommendationKpis(): Promise<ActionResult<KpiStat[]>> {
  const loaded = await load();
  if ("error" in loaded) return { success: false, error: loaded.error };
  const rows = loaded.data;

  const vehicles = rows.vehicles;

  const favourites = rows.favourites;

  const inquiries = rows.inquiries;

  const completedBuys = rows.completedBuys;

  const vehicleList = vehicles ?? [];
  const favouriteList = favourites ?? [];
  const inquiryList = inquiries ?? [];
  const buyList = completedBuys ?? [];

  const postedAt = (v: (typeof vehicleList)[number]) => (v.posted_at ? new Date(v.posted_at).getTime() : Date.now());
  const isRecent = (v: (typeof vehicleList)[number]) => postedAt(v) > Date.now() - FOUR_WEEKS_MS;

  const total = vehicleList.length;
  const totalPrevious = vehicleList.filter((v) => !isRecent(v)).length;

  const available = vehicleList.filter((v) => v.listing_state === "available");
  const availablePrevious = available.filter((v) => !isRecent(v)).length;

  const unitsSold = buyList.length;
  const unitsSoldPrevious = buyList.filter(
    (b) => new Date(b.completed_at).getTime() <= Date.now() - FOUR_WEEKS_MS,
  ).length;

  const recentVehicleIds = new Set(vehicleList.filter((v) => isRecent(v)).map((v) => v.id));
  const totalEngagements = favouriteList.length + inquiryList.length;
  const previousEngagements =
    favouriteList.filter((f) => !recentVehicleIds.has(f.vehicle_id)).length +
    inquiryList.filter((i) => !recentVehicleIds.has(i.vehicle_id)).length;

  const engagementRate = total > 0 ? (totalEngagements / total) * 100 : 0;
  const engagementRatePrevious = totalPrevious > 0 ? (previousEngagements / totalPrevious) * 100 : 0;

  const avgPrice =
    available.length > 0 ? available.reduce((sum, v) => sum + (Number(v.current_price) || 0), 0) / available.length : 0;
  const avgPricePrevious =
    availablePrevious > 0
      ? available.filter((v) => !isRecent(v)).reduce((sum, v) => sum + (Number(v.current_price) || 0), 0) /
        availablePrevious
      : 0;

  const cards: KpiStat[] = [
    {
      label: "Total Vehicles",
      value: formatCount(total),
      previous: formatCount(totalPrevious),
      change: changePercent(total, totalPrevious),
      direction: changePercent(total, totalPrevious) >= 0 ? "up" : "down",
      period: "last 4 weeks",
    },
    {
      label: "Active Listings",
      value: formatCount(available.length),
      previous: formatCount(availablePrevious),
      change: changePercent(available.length, availablePrevious),
      direction: changePercent(available.length, availablePrevious) >= 0 ? "up" : "down",
      period: "last 4 weeks",
    },
    {
      label: "Units Sold",
      value: formatCount(unitsSold),
      previous: formatCount(unitsSoldPrevious),
      change: changePercent(unitsSold, unitsSoldPrevious),
      direction: changePercent(unitsSold, unitsSoldPrevious) >= 0 ? "up" : "down",
      period: "last 4 weeks",
    },
    {
      label: "Engagement Rate",
      value: `${engagementRate.toFixed(1)}%`,
      previous: `${engagementRatePrevious.toFixed(1)}%`,
      change: changePercent(engagementRate, engagementRatePrevious),
      direction: changePercent(engagementRate, engagementRatePrevious) >= 0 ? "up" : "down",
      period: "last 4 weeks",
    },
    {
      label: "Average Price",
      value: formatCurrency(avgPrice, { currency: "PHP", noDecimals: true }),
      previous: formatCurrency(avgPricePrevious, { currency: "PHP", noDecimals: true }),
      change: changePercent(avgPrice, avgPricePrevious),
      direction: changePercent(avgPrice, avgPricePrevious) >= 0 ? "up" : "down",
      period: "last 4 weeks",
    },
  ];

  return { success: true, data: cards };
}

export async function getSalesOverview(): Promise<ActionResult<SalesOverviewPoint[]>> {
  const loaded = await load();
  if ("error" in loaded) return { success: false, error: loaded.error };
  const rows = loaded.data;

  const buys = rows.completedBuys;

  const purchases = rows.purchases;

  const priceByTransactionId = new Map<string, number>(
    (purchases ?? []).map((p) => [p.transaction_id, Number(p.final_price) || 0]),
  );

  const bucketRanges = ["01-05", "06-10", "11-15", "16-20", "21-25", "26-31"] as const;
  const currentMonth = new Date();
  currentMonth.setDate(1);

  const points: SalesOverviewPoint[] = [];
  for (let monthIndex = 11; monthIndex >= 0; monthIndex--) {
    const monthDate = new Date(currentMonth);
    monthDate.setMonth(currentMonth.getMonth() - monthIndex);
    const monthLabel = `${monthFormatter.format(monthDate)} ${String(monthDate.getFullYear()).slice(-2)}`;

    for (const range of bucketRanges) {
      const [start, end] = range.split("-").map(Number);
      let units = 0;
      let revenue = 0;

      for (const tx of buys ?? []) {
        const completed = new Date(tx.completed_at);
        if (
          completed.getFullYear() === monthDate.getFullYear() &&
          completed.getMonth() === monthDate.getMonth() &&
          completed.getDate() >= start &&
          completed.getDate() <= end
        ) {
          units += 1;
          revenue += priceByTransactionId.get(tx.id) ?? 0;
        }
      }

      points.push({ period: `${monthLabel} ${range}`, units, revenue });
    }
  }

  return { success: true, data: points };
}

export async function getTopVehicles(): Promise<
  ActionResult<{ categories: TopVehicleCategory[]; summary: number; products: TopVehicleProduct[] }>
> {
  const loaded = await load();
  if ("error" in loaded) return { success: false, error: loaded.error };
  const rows = loaded.data;

  const vehicles = rows.vehicles;

  const favourites = rows.favourites;

  const inquiries = rows.inquiries;

  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));
  const demandByVehicleId = new Map<string, number>();
  for (const fav of favourites ?? [])
    demandByVehicleId.set(fav.vehicle_id, (demandByVehicleId.get(fav.vehicle_id) ?? 0) + 1);
  for (const inquiry of inquiries ?? [])
    demandByVehicleId.set(inquiry.vehicle_id, (demandByVehicleId.get(inquiry.vehicle_id) ?? 0) + 1);

  const demandByBodyType = new Map<string, number>();
  for (const [vehicleId, demand] of demandByVehicleId) {
    const bodyType = vehicleById.get(vehicleId)?.body_type ?? "Other";
    demandByBodyType.set(bodyType, (demandByBodyType.get(bodyType) ?? 0) + demand);
  }

  const totalDemand = Array.from(demandByBodyType.values()).reduce((sum, demand) => sum + demand, 0);

  const topBodyTypes = Array.from(demandByBodyType.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topBodyTypeTotal = topBodyTypes.reduce((sum, [, demand]) => sum + demand, 0);
  const categoryColors = ["var(--chart-3)", "var(--chart-2)", "var(--chart-1)"] as const;

  const categories: TopVehicleCategory[] = topBodyTypes.map(([name, demand], index) => ({
    name,
    share: topBodyTypeTotal > 0 ? Math.round((demand / topBodyTypeTotal) * 100) : 0,
    color: categoryColors[index] ?? "var(--chart-1)",
  }));

  const topVehicles = Array.from(demandByVehicleId.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([vehicleId, demand]) => ({ vehicle: vehicleById.get(vehicleId), demand }))
    .flatMap(({ vehicle, demand }) => {
      if (!vehicle) return [];
      return [{ vehicle, demand }];
    });

  const products: TopVehicleProduct[] = topVehicles.map(({ vehicle, demand }) => ({
    name: `${vehicle.make} ${vehicle.model}`,
    category: vehicle.body_type ?? "Other",
    share: `${totalDemand > 0 ? Math.round((demand / totalDemand) * 100) : 0}%`,
    sales: formatCount(demand),
  }));

  const summary = products.reduce((sum, product) => sum + Number.parseInt(product.share, 10), 0);

  return { success: true, data: { categories, summary, products } };
}

export async function getInventoryStatus(): Promise<
  ActionResult<{ available: number; reserved: number; sold: number }>
> {
  const loaded = await load();
  if ("error" in loaded) return { success: false, error: loaded.error };
  const rows = loaded.data;

  const data = rows.vehicles;

  let available = 0;
  let reserved = 0;
  let sold = 0;
  for (const vehicle of data ?? []) {
    if (vehicle.listing_state === "available") available += 1;
    else if (vehicle.listing_state === "reserved") reserved += 1;
    else if (vehicle.listing_state === "sold") sold += 1;
  }

  return { success: true, data: { available, reserved, sold } };
}

export async function getInventoryAllocation(): Promise<ActionResult<AllocationItem[]>> {
  const loaded = await load();
  if ("error" in loaded) return { success: false, error: loaded.error };
  const rows = loaded.data;

  const vehicles = rows.vehicles.filter(
    (vehicle): vehicle is InsightRows["vehicles"][number] & { body_type: string } => vehicle.body_type !== null,
  );

  const valueByBodyType = new Map<string, number>();
  for (const vehicle of vehicles ?? []) {
    const bodyType = vehicle.body_type;
    valueByBodyType.set(bodyType, (valueByBodyType.get(bodyType) ?? 0) + (Number(vehicle.current_price) || 0));
  }

  const topBodyTypes = Array.from(valueByBodyType.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const totalValue = topBodyTypes.reduce((sum, [, value]) => sum + value, 0);

  const items: AllocationItem[] = topBodyTypes.map(([account, amount], index) => ({
    key: `allocation-${index + 1}`,
    account,
    amount,
    percentage: totalValue > 0 ? Math.round((amount / totalValue) * 1000) / 10 : 0,
    fill: ALLOCATION_COLORS[index] ?? "var(--chart-3)",
  }));

  return { success: true, data: items };
}

export async function getMarketActivity(): Promise<
  ActionResult<{ points: MarketActivityPoint[]; weekStart: number; weekEnd: number }>
> {
  const loaded = await load();
  if ("error" in loaded) return { success: false, error: loaded.error };
  const rows = loaded.data;

  const inquiries = rows.inquiries;

  const buys = rows.completedBuys;

  const now = new Date();
  const weekStartDate = new Date(now);
  weekStartDate.setHours(0, 0, 0, 0);
  const dayOfWeek = (weekStartDate.getDay() + 6) % 7;
  weekStartDate.setDate(weekStartDate.getDate() - dayOfWeek);
  const weekStart = weekStartDate.getTime();
  const weekEnd = weekStart + 7 * DAY_MS;

  const points: MarketActivityPoint[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayStart = weekStart + dayIndex * DAY_MS;
    const dayEnd = dayStart + DAY_MS;

    const inquiryCount = (inquiries ?? []).filter((inquiry) => {
      const time = new Date(inquiry.created_at).getTime();
      return time >= dayStart && time < dayEnd;
    }).length;

    const salesCount = (buys ?? []).filter((buy) => {
      const time = new Date(buy.completed_at).getTime();
      return time >= dayStart && time < dayEnd;
    }).length;

    points.push({
      date: new Date(dayStart).toISOString(),
      timestamp: dayStart,
      inquiries: inquiryCount,
      sales: salesCount,
    });
  }

  return { success: true, data: { points, weekStart, weekEnd } };
}
