"use client";

import { useRequireRole, useSession } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import { STAFF_ROLES } from "@/lib/auth/roles";

import type { PriceProposalRow } from "./_components/price-approvals";
import { VehicleOperations } from "./_components/vehicle-operations";

export default function VehiclesPage() {
  const allowed = useRequireRole(STAFF_ROLES);
  const role = useSession().role;
  // One Laravel read shaped for this page: proposals for the CEO/Head Accountant (with what GCE paid the
  // seller, T10), latest reconditioning state per car for the Marketing Specialist, and the global markup.
  const page = usePageData(allowed ? "staff-vehicles" : "staff-vehicles:denied", () =>
    allowed
      ? browserApi<{
          vehicles: Record<string, unknown>[];
          proposals: PriceProposalRow[];
          reconditioning_by_vehicle: Record<string, { state: string }>;
          default_markup_pct: number;
        }>("GET", "/api/v1/staff/vehicles")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const data = page.data;
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
