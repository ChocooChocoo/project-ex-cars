"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import { STAFF_ROLES } from "@/lib/auth/roles";

import { type PayrollRunRow, PayslipsSummary } from "./_components/payslips-summary";
import { PayslipsTable, type PayslipTableRow } from "./_components/payslips-table";

interface PayslipsData {
  view: "all" | "summary" | "own";
  userId: string;
  rows: PayslipTableRow[];
  ownRows: PayslipTableRow[];
  allRows: PayslipTableRow[];
  payrollRuns: PayrollRunRow[];
}

export default function PayslipsListPage() {
  const allowed = useRequireRole(STAFF_ROLES);
  // Phase 7: Laravel answers per role: Head Accountant all payslips, CEO/AM a summary, everyone else their own
  // finalized payslips.
  const page = usePageData(allowed ? "payslips" : "payslips:denied", () =>
    allowed ? browserApi<PayslipsData>("GET", "/api/v1/staff/payslips") : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const data = page.data;

  if (data.view === "summary") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Payslips</h1>
          <p className="text-muted-foreground text-sm">Summary and your payslip. Full browse behind View all.</p>
        </div>

        <PayslipsSummary
          payrollRuns={data.payrollRuns}
          ownRows={data.ownRows}
          allRows={data.allRows}
          userId={data.userId}
        />
      </div>
    );
  }

  const all = data.view === "all";
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Payslips</h1>
        <p className="text-muted-foreground text-sm">{all ? "All employee payslips." : "Your payslip history."}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{all ? "All Payslips" : "My Payslips"}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payslips available.</p>
          ) : (
            <PayslipsTable data={data.rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
