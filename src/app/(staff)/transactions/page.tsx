import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import type { TransactionRow } from "./_components/recent-transactions-table/schema";
import { RecentTransactionsTable } from "./_components/recent-transactions-table/table";
import { type TransactionsKpiDatum, TransactionsKpiStrip } from "./_components/transactions-kpi-strip";

export default async function TransactionsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ state?: string }>;
}) {
  const supabase = await createServerSupabase();
  const role = (await getCurrentRole()) ?? "customer";
  const { state } = await searchParams;

  let query = supabase
    .from("transactions")
    .select(
      "*, vehicles(make, model, year), profiles(full_name), purchase_details(*), sell_details(*), vehicle_requests(*)",
    )
    .order("updated_at", { ascending: false });

  if (state && ["pending", "under_review", "approved", "rejected", "completed", "cancelled"].includes(state)) {
    query = query.eq("current_state", state);
  }

  const { data: transactions } = await query;
  const all = (transactions as Record<string, unknown>[]) ?? [];

  const rows: TransactionRow[] = all.map((t) => {
    const vehicles = t.vehicles as Record<string, unknown> | null;
    const profile = t.profiles as Record<string, unknown> | null;

    return {
      id: t.id as string,
      customerName: (profile?.full_name as string | undefined) ?? "—",
      customerEmail: "",
      kind: t.transaction_kind as string,
      state: (t.current_state as string | undefined) ?? "pending",
      vehicleMake: (vehicles?.make as string | undefined) ?? "",
      vehicleModel: (vehicles?.model as string | undefined) ?? "",
      vehicleYear: (vehicles?.year as string | undefined) ?? "",
      openedAt: t.opened_at as string,
    };
  });

  const now = Date.now();
  const day = 86_400_000;
  const fourWeeksAgo = now - 28 * day;
  const eightWeeksAgo = now - 56 * day;

  const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

  function countInWindow(predicate: (t: Record<string, unknown>) => boolean, from: number, to: number): number {
    return all.filter((t) => {
      const opened = new Date(t.opened_at as string).getTime();
      return Number.isFinite(opened) && opened >= from && opened < to && predicate(t);
    }).length;
  }

  function kpiDatum(label: string, predicate: (t: Record<string, unknown>) => boolean): TransactionsKpiDatum {
    const value = countInWindow(predicate, fourWeeksAgo, now);
    const previous = countInWindow(predicate, eightWeeksAgo, fourWeeksAgo);
    const change = previous === 0 ? 0 : ((value - previous) / previous) * 100;

    return {
      label,
      value: compact.format(value),
      trendValue: `${change >= 0 ? "" : "-"}${Math.abs(change).toFixed(1)}%`,
      trendDirection: change >= 0 ? "up" : "down",
      previousValue: compact.format(previous),
      periodLabel: "last 4 weeks",
    };
  }

  const kpis: TransactionsKpiDatum[] = [
    kpiDatum("Pending", (t) => t.current_state === "pending"),
    kpiDatum("Under Review", (t) => t.current_state === "under_review"),
    kpiDatum("Completed", (t) => t.current_state === "completed"),
    kpiDatum("Buy", (t) => t.transaction_kind === "buy"),
    kpiDatum("Sell", (t) => t.transaction_kind === "sell"),
    kpiDatum("Requests", (t) => t.transaction_kind === "request_a_car"),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm">Manage buy, sell, and request-a-car transactions.</p>
      </div>
      <TransactionsKpiStrip data={kpis} />
      <RecentTransactionsTable data={rows} userRole={role} />
    </div>
  );
}
