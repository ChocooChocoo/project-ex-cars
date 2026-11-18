import { apiGet } from "@/lib/api/server";
import { requireRole } from "@/lib/auth/guards";

import type { InspectionRow } from "./_components/inspections-columns";
import { InspectionsTable } from "./_components/inspections-table";

export default async function InspectionsPage() {
  await requireRole(["ceo", "account_manager", "confidential_informant", "mechanic", "sales_manager"]);
  const { data: inspections } = await apiGet<InspectionRow[]>("/api/v1/staff/inspections");

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
