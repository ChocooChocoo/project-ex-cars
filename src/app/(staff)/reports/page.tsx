"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";

import { type ReportRow, ReportsClient } from "./_components/reports-client";

const REPORT_ROLES: GceRole[] = ["ceo", "head_accountant", "account_manager"];

export default function ReportsPage() {
  const allowed = useRequireRole(REPORT_ROLES);
  // Phase 7: CEO/HA read every report; the Account Manager reads their own.
  const page = usePageData(allowed ? "reports" : "reports:denied", () =>
    allowed
      ? browserApi<{ role: string; reports: ReportRow[] }>("GET", "/api/v1/staff/reports")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const { role, reports } = page.data;

  return (
    <ReportsClient
      reports={reports}
      canCreate={REPORT_ROLES.includes(role as GceRole)}
      canReview={["ceo", "head_accountant"].includes(role)}
    />
  );
}
