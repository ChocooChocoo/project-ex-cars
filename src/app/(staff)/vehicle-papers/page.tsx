import { getCurrentRole } from "@/app/auth/actions";
import { requireRole } from "@/lib/auth/guards";
import type { GceRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { withSignedTransactionDocumentUrls } from "@/lib/transactions/document-media";
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

  // The OR/CR is the original GCE kept when it bought the car, so it hangs on the car's sell
  // transaction, not on the purchase. The earliest sell row for the car is the one GCE bought.
  const orcrByVehicle = new Map<string, string>();
  const sellTransactionByVehicle = new Map<string, string>();
  const vehicleIds = [...new Set(records.map((record) => record.vehicleId).filter((id): id is string => Boolean(id)))];

  if (vehicleIds.length > 0) {
    const { data: sellTransactions } = await admin
      .from("transactions")
      .select("id, vehicle_id, opened_at")
      .in("vehicle_id", vehicleIds)
      .eq("transaction_kind", "sell")
      .order("opened_at", { ascending: true });

    for (const transaction of sellTransactions ?? []) {
      const vehicleId = transaction.vehicle_id as string | null;
      if (vehicleId && !sellTransactionByVehicle.has(vehicleId)) {
        sellTransactionByVehicle.set(vehicleId, transaction.id as string);
      }
    }
  }

  const sellTransactionIds = [...new Set(sellTransactionByVehicle.values())];
  if (sellTransactionIds.length > 0) {
    const { data: documents } = await admin
      .from("transaction_documents")
      .select("id, transaction_id, document_kind, storage_path")
      .in("transaction_id", sellTransactionIds)
      // T10: the CR (or the OR, or the old combined ORCR) stands in for the registration paper.
      .in("document_kind", ["orcr", "certificate_of_registration", "official_receipt"])
      .order("upload_date", { ascending: true });

    const signedDocuments = await withSignedTransactionDocumentUrls(
      admin.storage,
      (documents as Record<string, unknown>[] | null) ?? [],
    );
    const orcrBySellTransaction = new Map<string, string>();
    for (const document of signedDocuments) {
      const sellTransactionId = String(document.transaction_id);
      if (document.signed_url && !orcrBySellTransaction.has(sellTransactionId)) {
        orcrBySellTransaction.set(sellTransactionId, document.signed_url);
      }
    }
    for (const [vehicleId, sellTransactionId] of sellTransactionByVehicle) {
      const signedUrl = orcrBySellTransaction.get(sellTransactionId);
      if (signedUrl) orcrByVehicle.set(vehicleId, signedUrl);
    }
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
