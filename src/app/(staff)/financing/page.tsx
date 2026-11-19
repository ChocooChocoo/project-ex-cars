"use client";

import type { ComponentProps } from "react";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";

import { FinancingMonitor } from "./_components/financing-monitor";

type MonitorProps = ComponentProps<typeof FinancingMonitor>;

export default function FinancingPage() {
  const allowed = useRequireRole(["ceo", "head_accountant"]);
  // Phase 7: active financing accounts with their installments, open recovery cases and outright sales.
  const page = usePageData(allowed ? "financing" : "financing:denied", () =>
    allowed
      ? browserApi<{
          canRequest: boolean;
          accounts: MonitorProps["accounts"];
          cashSales: NonNullable<MonitorProps["cashSales"]>;
          workers: MonitorProps["workers"];
          cases: MonitorProps["cases"];
        }>("GET", "/api/v1/staff/financing")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const data = page.data;

  return (
    <FinancingMonitor
      accounts={data.accounts}
      cashSales={data.cashSales}
      workers={data.workers}
      cases={data.cases}
      canRequest={data.canRequest}
    />
  );
}
