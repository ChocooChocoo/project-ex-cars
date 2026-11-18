"use client";

import { notFound, redirect } from "next/navigation";

import { PageSkeleton } from "@/components/page-skeleton";
import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { browserApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { usePageData } from "@/lib/api/use-page-data";
import {
  contract,
  deedOfSale,
  missedPaymentPolicy,
  paperFinancing,
  paperSale,
  policyWarranty,
  type TransactionPaperSource,
} from "@/lib/papers/templates";
import { useRouteParam } from "@/lib/routing/use-route-param";
import { MISSED_PAYMENT_POLICY_LABEL } from "@/lib/transactions/missed-payment-policy";

import { PaperDocumentView } from "./paper-document-view";

type PaperData = {
  source: TransactionPaperSource;
  contractBody?: string | null;
  signaturePath?: string | null;
  ciSignaturePath?: string | null;
  buyerSignatureUrl?: string | null;
  ciSignatureUrl?: string | null;
};

/**
 * Phase 5: one printable paper's sale record, from Laravel. It allows the paper's staff roles, the buyer of the
 * transaction and the Confidential Informant assigned to its field case; anyone else goes to /unauthorized.
 */
function usePaper(paper: "contract" | "deed-of-sale" | "missed-payment-policy" | "policy-warranty") {
  const transactionId = useRouteParam("vehicle-papers");
  const page = usePageData(`paper/${paper}/${transactionId}`, () =>
    browserApi<PaperData>("GET", `/api/v1/papers/${encodeURIComponent(transactionId)}/${paper}`),
  );
  if (page.error instanceof ApiError && page.error.status === 404) notFound();
  if (page.error instanceof ApiError && page.error.status === 403) redirect("/unauthorized");
  if (page.error) throw page.error;
  return { transactionId, data: page.data };
}

/**
 * The sale contract, filled in from the transaction on record with the body the Sales Manager wrote and the
 * Head Accountant approved. Both signature images GCE recorded are shown under the sheet: the paper itself
 * stays text-only, so it prints without a photo of a signature.
 */
export function ContractPaper() {
  const { transactionId, data } = usePaper("contract");
  if (!data) return <PageSkeleton />;
  const paper = contract(paperSale(data.source), data.contractBody ?? null, {
    buyer: data.signaturePath ?? null,
    ci: data.ciSignaturePath ?? null,
  });
  const signatures = [
    { label: "Buyer signature", url: data.buyerSignatureUrl ?? null, alt: "Buyer signature" },
    {
      label: "Confidential Informant signature",
      url: data.ciSignatureUrl ?? null,
      alt: "Confidential Informant signature",
    },
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

/** The Deed of Sale for one sold car. The buyer is the transaction's own customer. */
export function DeedOfSalePaper() {
  const { data } = usePaper("deed-of-sale");
  if (!data) return <PageSkeleton />;
  return (
    <PaperDocumentView
      paper={deedOfSale(paperSale(data.source))}
      heading="Deed of Sale"
      note="Filled in from the sale on record. A blank line is a detail GCE has not recorded yet; write it in by hand before signing."
    />
  );
}

export function MissedPaymentPolicyPaper() {
  const { transactionId, data } = usePaper("missed-payment-policy");
  if (!data) return <PageSkeleton />;
  return (
    <PaperDocumentView
      paper={missedPaymentPolicy(paperSale(data.source), paperFinancing(data.source))}
      heading={MISSED_PAYMENT_POLICY_LABEL}
      note="Filled in from the financing sale on record. A blank line is a detail GCE has not recorded yet; write it in by hand before signing."
      backHref={`/dashboard/transactions/${transactionId}`}
      backLabel="Transaction"
    />
  );
}

/** The Policy & Warranty for one sold car; the wording is still a draft for client review. */
export function PolicyWarrantyPaper() {
  const { data } = usePaper("policy-warranty");
  if (!data) return <PageSkeleton />;
  return (
    <PaperDocumentView
      paper={policyWarranty(paperSale(data.source))}
      heading="Policy & Warranty"
      note="Draft terms for client review, filled in with the car's recorded warranty. GCE has not issued the final Policy & Warranty yet."
    />
  );
}
