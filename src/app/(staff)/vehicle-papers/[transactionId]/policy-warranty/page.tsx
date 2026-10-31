import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import type { GceRole } from "@/lib/auth/roles";
import { paperSale, policyWarranty, type TransactionPaperSource } from "@/lib/papers/templates";
import { createAdminClient } from "@/lib/supabase/admin";

import { PaperDocumentView } from "../../_components/paper-document-view";

const VEHICLE_PAPERS_ROLES: GceRole[] = ["confidential_informant", "ceo"];

/**
 * The Policy & Warranty for one sold car. The wording is still a draft for client review, so the paper
 * says so; the car's own warranty terms come from `vehicles.warranty_details`.
 */
export default async function PolicyWarrantyPage({ params }: { readonly params: Promise<{ transactionId: string }> }) {
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

  const paper = policyWarranty(paperSale(data as unknown as TransactionPaperSource));

  return (
    <PaperDocumentView
      paper={paper}
      heading="Policy & Warranty"
      note="Draft terms for client review, filled in with the car's recorded warranty. GCE has not issued the final Policy & Warranty yet."
    />
  );
}
