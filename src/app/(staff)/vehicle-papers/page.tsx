"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";
import {
  type SellerPapersRow,
  type VehiclePaperRecord,
  type VehiclePaperSource,
  vehiclePaperRecord,
} from "@/lib/transactions/vehicle-papers";

import { SellerPapersTable } from "./_components/seller-papers-table";
import { type VehiclePaperRow, VehiclePapersTable } from "./_components/vehicle-papers-table";

const VEHICLE_PAPERS_ROLES: GceRole[] = ["confidential_informant", "ceo"];

/**
 * The Confidential Informant's Vehicle Papers tab. SN-4: "From sellers" lists the originals each seller gave GCE
 * (captured by the Marketing Specialist after the purchase); "To buyers" lists the sold cars whose papers are on
 * the move, with the OR/CR kept from the car's own sell transaction. CI and CEO only.
 */
export default function VehiclePapersPage() {
  const allowed = useRequireRole(VEHICLE_PAPERS_ROLES);
  const page = usePageData(allowed ? "vehicle-papers" : "vehicle-papers:denied", () =>
    allowed
      ? browserApi<{
          role: string | null;
          handovers: VehiclePaperSource[];
          orcrByVehicle: Record<string, string>;
          fromSellers: SellerPapersRow[];
        }>("GET", "/api/v1/staff/vehicle-papers")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const role = page.data.role;
  const records: VehiclePaperRecord[] = page.data.handovers.map(vehiclePaperRecord);
  const orcrByVehicle = new Map(Object.entries(page.data.orcrByVehicle));

  const tableRows: VehiclePaperRow[] = records.map((record) => ({
    transactionId: record.transactionId,
    vehicle: record.vehicle,
    buyer: record.buyer,
    status: record.status,
    arrangementKind: record.arrangementKind,
    paymentMethod: record.paymentMethod,
    updatedAt: record.updatedAt,
    orcrUrl: record.vehicleId ? (orcrByVehicle.get(record.vehicleId) ?? null) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl tracking-tight">Vehicle Papers</h1>
        <p className="text-muted-foreground text-sm">
          The OR/CR and Deed of Sale GCE received from sellers, and the papers of sold cars. The Confidential Informant
          keeps the originals until release.
        </p>
      </div>
      <Tabs defaultValue="sellers">
        <TabsList>
          <TabsTrigger value="sellers">From sellers ({page.data.fromSellers.length})</TabsTrigger>
          <TabsTrigger value="buyers">To buyers ({tableRows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="sellers" className="pt-2">
          <SellerPapersTable rows={page.data.fromSellers} />
        </TabsContent>
        <TabsContent value="buyers" className="pt-2">
          <VehiclePapersTable rows={tableRows} canRelease={role === "confidential_informant"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
