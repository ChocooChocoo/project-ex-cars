"use client";

import { notFound, redirect } from "next/navigation";

import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { usePageData } from "@/lib/api/use-page-data";
import {
  contract,
  deedOfSale,
  missedPaymentPolicy,
  type PaperSigners,
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
  signatures?: PaperSigners;
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
 * Head Accountant approved. BC-2: the buyer's and GCE's signatures are drawn on the sheet over the printed names.
 */
export function ContractPaper() {
  const { transactionId, data } = usePaper("contract");
  if (!data) return <PageSkeleton />;
  return (
    <PaperDocumentView
      paper={contract(paperSale(data.source), data.contractBody ?? null, data.signatures ?? null)}
      heading="Contract"
      note="Filled in from the sale on record, with the contract text the Sales Manager wrote. A signature line stays empty until it is signed in the app or by pen."
      backHref={`/dashboard/transactions/${transactionId}`}
      backLabel="Transaction"
    />
  );
}

/** The Deed of Sale for one sold car. The buyer is the transaction's own customer. */
export function DeedOfSalePaper() {
  const { data } = usePaper("deed-of-sale");
  if (!data) return <PageSkeleton />;
  return (
    <PaperDocumentView
      paper={deedOfSale(paperSale(data.source), data.signatures ?? null)}
      heading="Deed of Sale"
      note="Filled in from the sale on record, with the signatures recorded in the app. A blank line is a detail GCE has not recorded yet; write it in by hand before signing."
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

/** BC-6: the Policy & Warranty of a financing sale, with the missed-payment clauses and both signatures. */
export function PolicyWarrantyPaper() {
  const { data } = usePaper("policy-warranty");
  if (!data) return <PageSkeleton />;
  return (
    <PaperDocumentView
      paper={policyWarranty(paperSale(data.source), paperFinancing(data.source), data.signatures ?? null)}
      heading="Policy & Warranty"
      note="GCE's standard warranty and missed payment policy for a financing sale, filled in from the sale on record."
    />
  );
}
