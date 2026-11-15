import { notFound } from "next/navigation";

import { paperSale, policyWarranty, type TransactionPaperSource } from "@/lib/papers/templates";
import { createAdminClient } from "@/lib/supabase/admin";

import { PaperDocumentView } from "../../_components/paper-document-view";
import { requirePaperReader } from "../../_lib/paper-access";

// T11: the Policy & Warranty for one sold car. The Confidential Informant prints it; the buyer keeps their
// own copy, so they may open it too.
const WARRANTY_ROLES = ["confidential_informant", "ceo", "head_accountant", "sales_manager"] as const;

/**
 * The Policy & Warranty for one sold car. The wording is still a draft for client review, so the paper
 * says so; the car's own warranty terms come from `vehicles.warranty_details`.
 */
export default async function PolicyWarrantyPage({ params }: { readonly params: Promise<{ transactionId: string }> }) {
  const { transactionId } = await params;
  await requirePaperReader(transactionId, [...WARRANTY_ROLES]);
  const admin = createAdminClient();

  const { data } = await admin
    .from("transactions")
    .select(
      "id, opened_at, completed_at, purchase_details(final_price), profiles(full_name, address), vehicles(make, model, year, exterior_color, plate_number, engine_number, chassis_number, vin, warranty_details)",
    )
    .eq("id", transactionId)
    .maybeSingle();

  if (!data) notFound();

  const paper = policyWarranty(paperSale(data as unknown as TransactionPaperSource));

  return (
    <PaperDocumentView
      paper={paper}
      heading="Policy & Warranty"
      note="Draft terms for client review, filled in with the car's recorded warranty. GCE has not issued the final Policy & Warranty yet."
    />
  );
}
