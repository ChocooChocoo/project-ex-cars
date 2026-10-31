import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import type { GceRole } from "@/lib/auth/roles";
import { deedOfSale, paperSale, type TransactionPaperSource } from "@/lib/papers/templates";
import { createAdminClient } from "@/lib/supabase/admin";

import { PaperDocumentView } from "../../_components/paper-document-view";

const VEHICLE_PAPERS_ROLES: GceRole[] = ["confidential_informant", "ceo"];

/**
 * The Deed of Sale for one sold car, filled in from the transaction on record. The buyer is the
 * transaction's own customer, so the deed never names an earlier or later buyer of the same car.
 */
export default async function DeedOfSalePage({ params }: { readonly params: Promise<{ transactionId: string }> }) {
  await requireRole(VEHICLE_PAPERS_ROLES);
  const { transactionId } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("transactions")
    .select(
      "id, opened_at, completed_at, purchase_details(final_price), profiles(full_name, address), vehicles(make, model, year, exterior_color, plate_number, engine_number, chassis_number, vin, warranty_details)",
    )
    .eq("id", transactionId)
    .maybeSingle();

  if (!data) notFound();

  const paper = deedOfSale(paperSale(data as unknown as TransactionPaperSource));

  return (
    <PaperDocumentView
      paper={paper}
      heading="Deed of Sale"
      note="Filled in from the sale on record. A blank line is a detail GCE has not recorded yet; write it in by hand before signing."
    />
  );
}
