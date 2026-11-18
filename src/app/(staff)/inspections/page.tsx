"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";

import type { InspectionRow } from "./_components/inspections-columns";
import { InspectionsTable } from "./_components/inspections-table";

export default function InspectionsPage() {
  const allowed = useRequireRole(["ceo", "account_manager", "confidential_informant", "mechanic", "sales_manager"]);
  const page = usePageData(allowed ? "inspections" : "inspections:denied", () =>
    allowed ? browserApi<InspectionRow[]>("GET", "/api/v1/staff/inspections") : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const inspections = page.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Vehicle Inspections</h1>
          <p className="text-muted-foreground text-sm">View mechanic inspection reports and checklist results.</p>
        </div>
      </div>
      <InspectionsTable inspections={inspections} />
    </div>
  );
}
