import { apiGet } from "@/lib/api/server";

import { ReportReview } from "../_components/report-review";

export default async function ReportsPage() {
  // CEO and Account Manager only (the old RLS rule); other roles get an empty list, as RLS gave them.
  const reports = await apiGet<Record<string, unknown>[]>("/api/v1/staff/message-reports")
    .then((result) => result.data)
    .catch(() => []);

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
