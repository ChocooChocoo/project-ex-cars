"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";

import { EmployeeAccountForm } from "./_components/employee-account-form";
import { type PerformanceReviewRow, PerformanceReviews } from "./_components/performance-reviews";
import { StaffRecordsTable, type StaffTableRow } from "./_components/staff-table/table";
import { WalkInForm } from "./_components/walk-in-form";

const STAFF_RECORD_ROLES: GceRole[] = ["ceo", "account_manager", "sales_manager"];

export default function StaffRecordsPage() {
  const allowed = useRequireRole(STAFF_RECORD_ROLES);
  // Phase 7: Laravel returns the active staff accounts with role and schedule, and the reviews this role may read.
  const page = usePageData(allowed ? "staff-records" : "staff-records:denied", () =>
    allowed
      ? browserApi<{
          role: string;
          accounts: StaffTableRow[];
          employees: { id: string; full_name: string | null }[];
          reviews: PerformanceReviewRow[];
        }>("GET", "/api/v1/staff/staff-records")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const { role, accounts, reviews } = page.data;
  const employeeOptions = page.data.employees;
  const createWalkIn = new URLSearchParams(window.location.search).get("createWalkIn");

  return (
    <Tabs defaultValue="staff" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Staff Records</h1>
          <p className="text-muted-foreground text-sm">Manage employee accounts.</p>
        </div>
        {role === "account_manager" || role === "ceo" ? (
          <div className="flex flex-wrap gap-2">
            <WalkInForm initialOpen={createWalkIn === "1"} />
            <EmployeeAccountForm />
          </div>
        ) : null}
      </div>

      <TabsList className="w-fit gap-1">
        <TabsTrigger value="staff">Staff</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
      </TabsList>

      <TabsContent value="staff">
        <Card>
          <CardHeader>
            <CardTitle className="leading-none">{accounts.length} Accounts</CardTitle>
            <CardDescription>Staff accounts with role, schedule, and status.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <StaffRecordsTable data={accounts} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="reviews">
        <PerformanceReviews
          reviews={reviews}
          employees={employeeOptions}
          canManage={["ceo", "account_manager"].includes(role)}
        />
      </TabsContent>
    </Tabs>
  );
}
