import { isFieldArrangement, type PapersStatus } from "./buy-flow";

export type VehiclePapersAction = "approve_release" | "hand_to_buyer" | "release_to_ci";

type Embedded<T> = T | T[] | null;

type SaleArrangement = { arrangement_kind?: unknown } | null;

export interface VehiclePaperSource {
  transaction_id: string;
  papers_status: string | null;
  papers_updated_at: string | null;
  transactions: Embedded<{
    purchase_details: Embedded<{ arrangement_kind: string | null; payment_method?: string | null }>;
    profiles: Embedded<{ full_name: string | null }>;
    vehicles: Embedded<{
      id: string;
      make: string | null;
      model: string | null;
      year: number | null;
      stock_code: string | null;
    }>;
  }>;
}

export interface VehiclePaperRecord {
  transactionId: string;
  vehicle: string;
  buyer: string;
  status: PapersStatus;
  arrangementKind: string | null;
  paymentMethod: string | null;
  updatedAt: string | null;
  vehicleId: string | null;
}

function one<T>(value: Embedded<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// One paper request as the table shows it: who bought the car, which car, and the custody step.
export function vehiclePaperRecord(row: VehiclePaperSource): VehiclePaperRecord {
  const sale = one(row.transactions);
  const buyer = one(sale?.profiles ?? null);
  const car = one(sale?.vehicles ?? null);
  const details = one(sale?.purchase_details ?? null);

  return {
    transactionId: row.transaction_id,
    vehicle: car ? `${car.year} ${car.make} ${car.model} (${car.stock_code})` : "A sold car",
    buyer: String(buyer?.full_name ?? "the buyer"),
    status: row.papers_status as PapersStatus,
    arrangementKind: typeof details?.arrangement_kind === "string" ? details.arrangement_kind : null,
    paymentMethod: typeof details?.payment_method === "string" ? details.payment_method : null,
    updatedAt: row.papers_updated_at,
    vehicleId: car?.id ?? null,
  };
}

// Which release step the 3-dot menu offers for a paper request.
// A GCE visit asks the CI to approve the Sales Manager's request; a meet-up or delivery lets the CI
// record the papers out to himself first, then hand them to the buyer.
export function vehiclePapersAction(
  status: PapersStatus | null,
  arrangement: SaleArrangement,
): VehiclePapersAction | null {
  if (status === "requested") return "approve_release";
  if (status === "released_to_ci") return "hand_to_buyer";
  if (isFieldArrangement(arrangement) && (!status || status === "returned")) return "release_to_ci";
  return null;
}

// SN-4: the originals one seller gave GCE, as the "From sellers" tab lists them.
export type PapersCustodyState = "with_ci" | "released" | "on_hold";

export const PAPERS_CUSTODY_LABELS: Record<PapersCustodyState, string> = {
  with_ci: "With the Confidential Informant",
  released: "Released",
  on_hold: "On Hold",
};

export interface SellerPapersRow {
  vehicle_id: string;
  vehicle: string;
  seller: string | null;
  source_transaction_id: string | null;
  received_at: string | null;
  custody_state: PapersCustodyState;
  papers: { document_kind: string; label: string; url: string | null }[];
}
