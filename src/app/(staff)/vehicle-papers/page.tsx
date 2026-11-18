import { requireRole } from "@/lib/auth/guards";
import type { GceRole } from "@/lib/auth/roles";
import { getCurrentRole } from "@/lib/auth/server-session";
import { previousOwnerDocuments } from "@/lib/papers/previous-owner-documents";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type VehiclePaperRecord,
  type VehiclePaperSource,
  vehiclePaperRecord,
} from "@/lib/transactions/vehicle-papers";

import { type VehiclePaperRow, VehiclePapersTable } from "./_components/vehicle-papers-table";

const VEHICLE_PAPERS_ROLES: GceRole[] = ["confidential_informant", "ceo"];

/**
 * The Confidential Informant's Vehicle Papers tab: every car whose papers are on the move, with the
 * OR/CR kept from the car's own sell transaction. Only the CI reads the papers under RLS, so the list
 * and the signed documents are read with the service role, behind the role guard.
 */
export default async function VehiclePapersPage() {
  await requireRole(VEHICLE_PAPERS_ROLES);
  const role = await getCurrentRole();
  const admin = createAdminClient();

  const { data: handovers } = await admin
    .from("sale_handovers")
    .select(
      "transaction_id, papers_status, papers_updated_at, transactions(id, purchase_details(arrangement_kind), profiles(full_name), vehicles(id, make, model, year, stock_code))",
    )
    .not("papers_status", "is", null)
    .order("papers_updated_at", { ascending: true });

  const records: VehiclePaperRecord[] = ((handovers as VehiclePaperSource[] | null) ?? []).map(vehiclePaperRecord);

  // The OR/CR is the original GCE kept when it bought the car, so it hangs on the car's sell transaction,
  // not on the purchase. T11: the same lookup the field case uses, so both screens show one set of papers.
  const orcrByVehicle = new Map<string, string>();
  const vehicleIds = [...new Set(records.map((record) => record.vehicleId).filter((id): id is string => Boolean(id)))];
  const papersByVehicle = await Promise.all(
    vehicleIds.map(async (vehicleId) => [vehicleId, await previousOwnerDocuments(admin, vehicleId)] as const),
  );
  for (const [vehicleId, documents] of papersByVehicle) {
    // The CR (or the OR, or the old combined ORCR) stands in for the registration paper; the deed is separate.
    const registration = documents.find((document) => document.signed_url && document.document_kind !== "deed_of_sale");
    if (registration?.signed_url) orcrByVehicle.set(vehicleId, registration.signed_url);
  }

  const tableRows: VehiclePaperRow[] = records.map((record) => ({
    transactionId: record.transactionId,
    vehicle: record.vehicle,
    buyer: record.buyer,
    status: record.status,
    arrangementKind: record.arrangementKind,
    updatedAt: record.updatedAt,
    orcrUrl: record.vehicleId ? (orcrByVehicle.get(record.vehicleId) ?? null) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl tracking-tight">Vehicle Papers</h1>
        <p className="text-muted-foreground text-sm">
          The OR/CR, Deed of Sale and Policy &amp; Warranty for sold cars. The Confidential Informant keeps them until
          release.
        </p>
      </div>
      <VehiclePapersTable rows={tableRows} canRelease={role === "confidential_informant"} />
    </div>
  );
}
