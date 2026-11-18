"use client";

import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";

import { ReportReview } from "../_components/report-review";

export default function ReportsPage() {
  // CEO and Account Manager only (the old RLS rule); other roles get an empty list, as RLS gave them.
  const page = usePageData("message-reports", () =>
    browserApi<Record<string, unknown>[]>("GET", "/api/v1/staff/message-reports").catch(() => []),
  );
  if (!page.data) return <PageSkeleton />;
  const reports = page.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Message Reports</h1>
        <p className="text-muted-foreground text-sm">Review reported messages and conversations.</p>
      </div>
      <ReportReview reports={reports} />
    </div>
  );
}
