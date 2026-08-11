import { requireRole } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";

import type { InspectionRow } from "./_components/inspections-columns";
import { InspectionsTable } from "./_components/inspections-table";

export default async function InspectionsPage() {
  await requireRole(["ceo", "account_manager", "confidential_informant", "mechanic", "sales_manager"]);
  const supabase = await createServerSupabase();

  const { data: inspections } = await supabase
    .from("vehicle_inspections")
    .select("*, vehicles(make, model, year, stock_code)")
    .order("inspection_date", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Vehicle Inspections</h1>
          <p className="text-muted-foreground text-sm">View mechanic inspection reports and checklist results.</p>
        </div>
      </div>
      <InspectionsTable inspections={(inspections as unknown as InspectionRow[]) ?? []} />
    </div>
  );
}
