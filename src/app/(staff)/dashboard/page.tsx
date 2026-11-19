"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import { STAFF_ROLES } from "@/lib/auth/roles";

import { MetricCards } from "./_components/metric-cards";
import { NextMonthForecast } from "./_components/next-month-forecast";
import { PerformanceOverview } from "./_components/performance-overview";
import { type OperationsCounts, Phase6Overview } from "./_components/phase6-overview";
import { ReconditioningOverview, type ReconditioningVehicle } from "./_components/reconditioning-overview";
import { type DashboardRevenue, type DashboardTransaction, summarizeDashboard } from "./dashboard-summary";

interface DashboardData {
  role: string;
  transactions: DashboardTransaction[];
  revenue: DashboardRevenue[] | null;
  availableVehicles: number;
  operations: OperationsCounts | null;
  reconditioning: ReconditioningVehicle[];
}

export default function Page() {
  const allowed = useRequireRole(STAFF_ROLES);
  // Phase 7: Laravel returns company-wide inputs (money received only to the finance roles); opening the page
  // no longer sends notices, the scheduler does (trading:deadlines, finance:installments).
  const page = usePageData(allowed ? "dashboard" : "dashboard:denied", () =>
    allowed ? browserApi<DashboardData>("GET", "/api/v1/staff/dashboard") : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const data = page.data;
  const isCeo = data.role === "ceo";
  const summary = summarizeDashboard({
    transactions: data.transactions,
    revenue: data.revenue,
    availableVehicles: data.availableVehicles,
  });

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      {isCeo && data.operations ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold text-lg tracking-tight">Operations Overview</h2>
            <p className="text-muted-foreground text-sm">
              Live counts from staff, payroll, field, and finance records.
            </p>
          </div>
          <Phase6Overview counts={data.operations} />
        </section>
      ) : null}
      <MetricCards summary={summary} />
      {isCeo ? <NextMonthForecast forecast={summary.forecast} /> : null}
      <PerformanceOverview monthly={summary.monthly} />
      <ReconditioningOverview vehicles={data.reconditioning} />
    </div>
  );
}
