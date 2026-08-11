import { getCurrentRole } from "@/app/auth/actions";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";

import type { PriceProposalRow } from "./_components/price-approvals";
import { VehicleOperations } from "./_components/vehicle-operations";

export default async function VehiclesPage() {
  await requireRole(STAFF_ROLES);
  const supabase = await createServerSupabase();
  const role = (await getCurrentRole()) ?? null;

  const { data: vehicles } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });

  const isCeo = role === "ceo";
  const canManage = role === "marketing_specialist";
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
      <VehicleOperations
        proposals={(proposals as unknown as PriceProposalRow[]) ?? []}
        vehicles={(vehicles as Record<string, unknown>[]) ?? []}
        canManage={canManage}
      />
    </div>
  );
}
