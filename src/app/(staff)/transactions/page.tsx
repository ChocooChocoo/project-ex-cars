"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import { TRANSACTION_VIEWER_ROLES } from "@/lib/auth/roles";
import { useQuery } from "@/lib/routing/use-query";
import { paidInstallmentCount } from "@/lib/transactions/financing-payments";

import type { TransactionRow } from "./_components/recent-transactions-table/schema";
import { RecentTransactionsTable } from "./_components/recent-transactions-table/table";
import { type TransactionsKpiDatum, TransactionsKpiStrip } from "./_components/transactions-kpi-strip";

export default function TransactionsPage() {
  const allowed = useRequireRole(TRANSACTION_VIEWER_ROLES);
  const query = useQuery();
  const state = query?.get("state") ?? "";
  // Phase 5: Laravel applies the same record rules as before (the Sales Manager sees buy requests only, the
  // Marketing Specialist sell offers only) and the optional ?state= filter.
  const page = usePageData(allowed && query ? `staff-transactions?${state}` : "staff-transactions:wait", () =>
    allowed && query
      ? browserApi<{ role: string | null; transactions: Record<string, unknown>[] }>(
          "GET",
          `/api/v1/staff/transactions${state ? `?state=${encodeURIComponent(state)}` : ""}`,
        )
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const role = page.data.role ?? "customer";
  const all = page.data.transactions;

  const rows: TransactionRow[] = all.map((t) => {
    const vehicles = t.vehicles as Record<string, unknown> | null;
    const profile = t.profiles as Record<string, unknown> | null;
    const purchase = Array.isArray(t.purchase_details) ? t.purchase_details[0] : t.purchase_details;
    const account = (Array.isArray(t.installment_accounts) ? t.installment_accounts[0] : t.installment_accounts) as {
      installments?: { state: unknown }[];
    } | null;
    const installments = account?.installments ?? [];

    return {
      id: t.id as string,
      customerName: (profile?.full_name as string | undefined) ?? "—",
      customerEmail: "",
      kind: t.transaction_kind as string,
      state: (t.current_state as string | undefined) ?? "pending",
      paymentMethod: ((purchase as Record<string, unknown> | null)?.payment_method as string | undefined) ?? "",
      vehicleMake: (vehicles?.make as string | undefined) ?? "",
      vehicleModel: (vehicles?.model as string | undefined) ?? "",
      vehicleYear: (vehicles?.year as string | undefined) ?? "",
      openedAt: t.opened_at as string,
      paidInstallments: paidInstallmentCount(installments),
      totalInstallments: installments.length,
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
    ...(role === "sales_manager" ? [] : [kpiDatum("Sell", (t) => t.transaction_kind === "sell")]),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm">
          {role === "sales_manager" ? "Manage buying transactions." : "Manage buy and sell transactions."}
        </p>
      </div>
      <TransactionsKpiStrip data={kpis} />
      <RecentTransactionsTable data={rows} userRole={role} />
    </div>
  );
}
