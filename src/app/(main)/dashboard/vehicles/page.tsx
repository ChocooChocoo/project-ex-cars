import { createServerSupabase } from "@/lib/supabase/server";

import { VehicleTable } from "./_components/vehicles-table";

export default async function VehiclesPage() {
  const supabase = await createServerSupabase();

  const { data: vehicles } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Vehicle Inventory</h1>
          <p className="text-muted-foreground text-sm">Manage vehicle listings, pricing, and publishing.</p>
        </div>
      </div>
      <VehicleTable vehicles={(vehicles as Record<string, unknown>[]) ?? []} />
    </div>
  );
}
