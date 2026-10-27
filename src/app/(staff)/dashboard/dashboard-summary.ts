// Turns raw rows into the staff dashboard numbers (T03 G3). Pure, so it is unit-tested without Supabase.
// ponytail: aggregates in JS over every transaction row; move to a SQL view if transactions reach the tens of thousands.

export type DashboardTransaction = {
  customer_id: string;
  opened_at: string;
  completed_at: string | null;
  current_state: string;
};

/** A verified customer payment: pesos, and the day it was paid. */
export type DashboardRevenue = { amount: number | string | null; date: string | null };

export type MonthPoint = { month: string; sales: number; newCustomers: number };

export type DashboardSummary = {
  salesThisMonth: number;
  salesLastMonth: number;
  salesChange: number | null;
  newCustomers: number;
  newCustomersPrevious: number;
  newCustomersChange: number | null;
  activeCustomers: number;
  /** Pesos; null when the role may not read revenue. */
  revenueThisMonth: number | null;
  revenueLastMonth: number | null;
  revenueChange: number | null;
  availableVehicles: number;
  monthly: MonthPoint[];
};

const OPEN_STATES = new Set(["pending", "under_review", "approved"]);
const DAY_MS = 24 * 60 * 60 * 1000;

const monthFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" });

/** "YYYY-MM" of a moment, in Manila time. */
export function manilaMonth(date: Date | string): string {
  return monthFormat.format(typeof date === "string" ? new Date(date) : date).slice(0, 7);
}

function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function summarizeDashboard(
  data: {
    transactions: DashboardTransaction[];
    revenue: DashboardRevenue[] | null;
    availableVehicles: number;
  },
  now: Date = new Date(),
): DashboardSummary {
  const thisMonth = manilaMonth(now);
  const lastMonth = shiftMonth(thisMonth, -1);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(thisMonth, i - 11));

  const sales = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  const active = new Set<string>();

  for (const tx of data.transactions) {
    if (tx.completed_at && tx.current_state === "completed") {
      const month = manilaMonth(tx.completed_at);
      sales.set(month, (sales.get(month) ?? 0) + 1);
    }
    const opened = new Date(tx.opened_at).getTime();
    const seen = firstSeen.get(tx.customer_id);
    if (seen === undefined || opened < seen) firstSeen.set(tx.customer_id, opened);
    if (OPEN_STATES.has(tx.current_state)) active.add(tx.customer_id);
  }

  const nowMs = now.getTime();
  let newCustomers = 0;
  let newCustomersPrevious = 0;
  const newByMonth = new Map<string, number>();
  for (const first of firstSeen.values()) {
    const age = nowMs - first;
    if (age >= 0 && age < 30 * DAY_MS) newCustomers++;
    else if (age >= 30 * DAY_MS && age < 60 * DAY_MS) newCustomersPrevious++;
    const month = manilaMonth(new Date(first));
    newByMonth.set(month, (newByMonth.get(month) ?? 0) + 1);
  }

  let revenueThisMonth: number | null = null;
  let revenueLastMonth: number | null = null;
  if (data.revenue) {
    revenueThisMonth = 0;
    revenueLastMonth = 0;
    for (const entry of data.revenue) {
      if (!entry.date) continue;
      const pesos = Number(entry.amount ?? 0);
      const month = manilaMonth(entry.date);
      if (month === thisMonth) revenueThisMonth += pesos;
      else if (month === lastMonth) revenueLastMonth += pesos;
    }
  }

  const salesThisMonth = sales.get(thisMonth) ?? 0;
  const salesLastMonth = sales.get(lastMonth) ?? 0;

  return {
    salesThisMonth,
    salesLastMonth,
    salesChange: percentChange(salesThisMonth, salesLastMonth),
    newCustomers,
    newCustomersPrevious,
    newCustomersChange: percentChange(newCustomers, newCustomersPrevious),
    activeCustomers: active.size,
    revenueThisMonth,
    revenueLastMonth,
    revenueChange:
      revenueThisMonth === null || revenueLastMonth === null ? null : percentChange(revenueThisMonth, revenueLastMonth),
    availableVehicles: data.availableVehicles,
    monthly: months.map((month) => ({ month, sales: sales.get(month) ?? 0, newCustomers: newByMonth.get(month) ?? 0 })),
  };
}
