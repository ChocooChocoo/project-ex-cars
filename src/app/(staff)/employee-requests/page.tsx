"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import { STAFF_ROLES } from "@/lib/auth/roles";

import { EmployeeRequestsClient } from "./_components/employee-requests-client";
import type { EmployeeRequestRow } from "./_components/employee-requests-columns";

export default function EmployeeRequestsPage() {
  const allowed = useRequireRole(STAFF_ROLES);
  // Phase 7: Laravel returns own requests (all for CEO/AM) with signed links to the proof files.
  const page = usePageData(allowed ? "employee-requests" : "employee-requests:denied", () =>
    allowed
      ? browserApi<{ canReview: boolean; requests: EmployeeRequestRow[] }>("GET", "/api/v1/staff/employee-requests")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;

  return <EmployeeRequestsClient requests={page.data.requests} canReview={page.data.canReview} canSubmit />;
}
