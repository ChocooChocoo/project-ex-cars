import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { PriceApprovals, type PriceProposalRow } from "./_components/price-approvals";
import { VehicleTable } from "./_components/vehicles-table";

export default async function VehiclesPage() {
  const supabase = await createServerSupabase();
  const role = (await getCurrentRole()) ?? null;

  const { data: vehicles } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });

  const isCeo = role === "ceo";
  const { data: proposals } = isCeo
    ? await supabase
        .from("vehicle_price_proposals")
        .select("*, vehicles(make, model, year)")
        .eq("decision", "pending")
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Vehicle Inventory</h1>
          <p className="text-muted-foreground text-sm">Manage vehicle listings, pricing, and publishing.</p>
        </div>
      </div>
      {isCeo ? <PriceApprovals proposals={(proposals as unknown as PriceProposalRow[]) ?? []} /> : null}
      <VehicleTable vehicles={(vehicles as Record<string, unknown>[]) ?? []} />
    </div>
  );
}
