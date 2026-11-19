"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";

import { type CompensationRow, PayrollClient, type PayrollRunRow } from "./_components/payroll-client";

const PAYROLL_ROLES: GceRole[] = ["ceo", "account_manager", "head_accountant"];

export default function PayrollPage() {
  const allowed = useRequireRole(PAYROLL_ROLES);
  // Phase 7: Laravel returns the runs, the private compensation records (CEO/AM/HA) and, for CEO/AM, the staff list.
  const page = usePageData(allowed ? "payroll" : "payroll:denied", () =>
    allowed
      ? browserApi<{
          role: string;
          runs: PayrollRunRow[];
          compensation: CompensationRow[];
          employees: { id: string; full_name: string | null }[];
        }>("GET", "/api/v1/staff/payroll")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const { role, runs, compensation, employees } = page.data;

  return (
    <PayrollClient
      runs={runs}
      compensation={compensation}
      employees={employees}
      canPrepare={["ceo", "account_manager"].includes(role)}
      canReview={["ceo", "head_accountant"].includes(role)}
      canFinalize={role === "head_accountant"}
    />
  );
}
