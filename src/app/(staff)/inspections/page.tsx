import { createServerSupabase } from "@/lib/supabase/server";

import { InspectionsTable } from "./_components/inspections-table";

export default async function InspectionsPage() {
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
      <InspectionsTable inspections={(inspections as Record<string, unknown>[]) ?? []} />
    </div>
  );
}
