import { getCurrentRole } from "@/app/auth/actions";
import { apiGet } from "@/lib/api/server";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/roles";

import type { PriceProposalRow } from "./_components/price-approvals";
import { VehicleOperations } from "./_components/vehicle-operations";

export default async function VehiclesPage() {
  await requireRole(STAFF_ROLES);
  const role = (await getCurrentRole()) ?? null;
  // One Laravel read shaped for this page: proposals for the CEO/Head Accountant (with what GCE paid the
  // seller, T10), latest reconditioning state per car for the Marketing Specialist, and the global markup.
  const { data } = await apiGet<{
    vehicles: Record<string, unknown>[];
    proposals: PriceProposalRow[];
    reconditioning_by_vehicle: Record<string, { state: string; papers_processed_at: string | null }>;
    default_markup_pct: number;
  }>("/api/v1/staff/vehicles");
  const isCeo = role === "ceo";
  const isHeadAccountant = role === "head_accountant";
  const canManage = role === "marketing_specialist";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Vehicle Inventory</h1>
          <p className="text-muted-foreground text-sm">Manage vehicle listings, pricing, and publishing.</p>
        </div>
      </div>
      <VehicleOperations
        proposals={data.proposals}
        vehicles={data.vehicles}
        canManage={canManage}
        canView={isCeo}
        isHeadAccountant={isHeadAccountant}
        userRole={role}
        reconditioningByVehicle={data.reconditioning_by_vehicle}
        defaultMarkupPct={data.default_markup_pct}
      />
    </div>
  );
}
