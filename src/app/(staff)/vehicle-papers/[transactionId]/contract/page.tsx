import { notFound } from "next/navigation";

import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { contract, paperSale, type TransactionPaperSource } from "@/lib/papers/templates";
import { createAdminClient } from "@/lib/supabase/admin";

import { PaperDocumentView } from "../../_components/paper-document-view";
import { PAPER_ROLES, requirePaperReader } from "../../_lib/paper-access";

const SIGNATURE_TTL_SECONDS = 900;

/**
 * The sale contract, filled in from the transaction on record with the body the Sales Manager wrote and the
 * Head Accountant approved. Both signature images GCE recorded are shown under the sheet: the paper itself
 * stays text-only, so it prints without a photo of a signature.
 */
export default async function ContractPage({ params }: { readonly params: Promise<{ transactionId: string }> }) {
  const { transactionId } = await params;
  await requirePaperReader(transactionId, PAPER_ROLES);
  const admin = createAdminClient();

  const [{ data: transaction }, { data: handover }] = await Promise.all([
    admin
      .from("transactions")
      .select(
        "id, opened_at, completed_at, purchase_details(final_price), profiles(full_name, address), vehicles(make, model, year, exterior_color, plate_number, engine_number, chassis_number, vin, warranty_details)",
      )
      .eq("id", transactionId)
      .maybeSingle(),
    admin
      .from("sale_handovers")
      .select("contract_body, contract_state, contract_signed_at, signature_path, ci_signature_path")
      .eq("transaction_id", transactionId)
      .maybeSingle(),
  ]);
  if (!transaction) notFound();

  const signaturePath = typeof handover?.signature_path === "string" ? handover.signature_path : null;
  const ciSignaturePath = typeof handover?.ci_signature_path === "string" ? handover.ci_signature_path : null;
  const [buyerSignature, ciSignature] = await Promise.all(
    [signaturePath, ciSignaturePath].map(async (path) => {
      if (!path) return null;
      const { data } = await admin.storage.from("transaction-documents").createSignedUrl(path, SIGNATURE_TTL_SECONDS);
      return data?.signedUrl ?? null;
    }),
  );

  const paper = contract(
    paperSale(transaction as unknown as TransactionPaperSource),
    (handover?.contract_body as string | null | undefined) ?? null,
    { buyer: signaturePath, ci: ciSignaturePath },
  );
  const signatures = [
    { label: "Buyer signature", url: buyerSignature, alt: "Buyer signature" },
    { label: "Confidential Informant signature", url: ciSignature, alt: "Confidential Informant signature" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PaperDocumentView
        paper={paper}
        heading="Contract"
        note="Filled in from the sale on record, with the contract text the Sales Manager wrote. The signatures are shown below the sheet and are kept as images, not printed on it."
        backHref={`/dashboard/transactions/${transactionId}`}
        backLabel="Transaction"
      />

      <section aria-label="Recorded signatures" className="flex flex-col gap-3">
        <h2 className="font-medium tracking-tight">Recorded signatures</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {signatures.map((signature) => (
            <div key={signature.label} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
              <span className="text-sm">{signature.label}</span>
              {signature.url ? (
                <TransactionImagePreview
                  src={signature.url}
                  alt={signature.alt}
                  triggerClassName="h-32 w-full"
                  className="object-contain"
                />
              ) : (
                <span className="text-muted-foreground text-sm">Not signed yet.</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
