// T11: the registration papers that came with the car. GCE keeps the OR/CR of a car it bought on the sell
// transaction the Confidential Informant received it on, so both the field case and the Vehicle Papers tab
// read them from the earliest sell row for the vehicle. Server-only: callers hold the service-role client.

import type { createAdminClient } from "@/lib/supabase/admin";
import { type SignedTransactionDocument, withSignedTransactionDocumentUrls } from "@/lib/transactions/document-media";

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;

// The papers a car's registration is made of. The old combined 'orcr' row stands beside the T10 split.
export const VEHICLE_REGISTRATION_KINDS = [
  "orcr",
  "official_receipt",
  "certificate_of_registration",
  "deed_of_sale",
] as const;

/** The documents the previous owner handed over with the car, signed for display. */
export async function previousOwnerDocuments(
  admin: Admin,
  vehicleId: string | null,
): Promise<SignedTransactionDocument[]> {
  if (!vehicleId) return [];
  const { data: sell } = await admin
    .from("transactions")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .eq("transaction_kind", "sell")
    .order("opened_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!sell) return [];

  const { data: documents } = await admin
    .from("transaction_documents")
    .select("id, transaction_id, document_kind, storage_path, upload_date, note")
    .eq("transaction_id", sell.id)
    .in("document_kind", [...VEHICLE_REGISTRATION_KINDS])
    .order("upload_date", { ascending: true });
  return withSignedTransactionDocumentUrls(admin.storage, (documents as Row[] | null) ?? []);
}
