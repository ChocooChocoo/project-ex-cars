"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  activatePaymentTerms,
  approvePaymentTerms,
  instructRepossession,
  markInstallmentWaived,
  recordPaperwork,
  recordPayment,
  reviewSellTransaction,
  transitionTransaction,
  verifyPayment,
  verifyTransactionDocument,
} from "@/app/(staff)/transactions/actions";
import type { TransactionState } from "@/lib/transactions/state-machine";

import { TransactionDetailSidebarV1 } from "./transaction-detail-sidebar-v1";
import { TransactionOverviewV1 } from "./transaction-overview-v1";
import { TransactionPaymentProgressV1 } from "./transaction-payment-progress-v1";
import { TransactionPaymentsTableV1 } from "./transaction-payments-table-v1";
import { TransactionStatusTriageV1 } from "./transaction-status-triage-v1";

export function StaffTransactionDetail({
  transaction,
  history,
  documents,
  payments,
  installmentAccount,
  paymentTerms,
  viewingArrangements,
  userRole,
  informants,
}: {
  readonly transaction: Record<string, unknown>;
  readonly history: Record<string, unknown>[];
  readonly documents: Record<string, unknown>[];
  readonly payments: Record<string, unknown>[];
  readonly installmentAccount: Record<string, unknown> | null;
  readonly paymentTerms: Record<string, unknown> | null;
  readonly viewingArrangements: Record<string, unknown>[];
  readonly userRole: string;
  readonly informants: { id: string; full_name: string | null }[];
}) {
  const router = useRouter();
  const id = transaction.id as string;
  const kind = transaction.transaction_kind as string;
  const state = (transaction.current_state ?? "pending") as TransactionState;
  const vehicles = transaction.vehicles as Record<string, unknown> | undefined;
  const purchaseDetails = transaction.purchase_details as Record<string, unknown> | undefined;
  const sellDetails = transaction.sell_details as Record<string, unknown> | undefined;
  const vehicleRequests = transaction.vehicle_requests as Record<string, unknown> | undefined;
  const openedAt = transaction.opened_at as string;
  const completedAt = transaction.completed_at as string | null;
  const customerName = ((transaction.profiles as Record<string, unknown> | null)?.full_name as string | null) ?? null;
  const updatedAt = transaction.updated_at as string;

  const [transitioning, setTransitioning] = useState(false);

  async function doTransition(to: TransactionState) {
    setTransitioning(true);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("to_state", to);
    const result = await transitionTransaction(fd);
    setTransitioning(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Transaction moved to ${to.replace(/_/g, " ")}.`);
      router.refresh();
    }
  }

  async function onRecordPayment(amount: string, method: string, date: string) {
    const fd = new FormData();
    fd.set("transaction_id", id);
    fd.set("amount", amount);
    fd.set("method", method);
    fd.set("settlement_date", date);
    const result = await recordPayment(fd);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Payment recorded.");
      router.refresh();
    }
  }

  async function onReviewSell(decision: string, valuation: string, notes: string) {
    const fd = new FormData();
    fd.set("transaction_id", id);
    fd.set("valuation_amount", valuation);
    fd.set("decision", decision);
    fd.set("review_notes", notes);
    const result = await reviewSellTransaction(fd);
    if (result.error) toast.error(result.error);
    else {
      toast.success(`Sell ${decision}.`);
      router.refresh();
    }
  }

  async function onUploadDocument(documentKind: string, idType: string, file: File) {
    const fd = new FormData();
    fd.set("transaction_id", id);
    fd.set("document_kind", documentKind);
    fd.set("id_type", idType);
    fd.set("file", file);
    const result = await recordPaperwork(fd);
    if (result.error) toast.error(result.error);
    else {
      toast.success(
        documentKind === "valid_id"
          ? "Valid ID uploaded. Verify it below."
          : "Proof of billing uploaded. Verify it below.",
      );
      router.refresh();
    }
  }

  async function onVerifyDocument(documentId: string) {
    const fd = new FormData();
    fd.set("document_id", documentId);
    fd.set("decision", "verified");
    const result = await verifyTransactionDocument(fd);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Document verified.");
      router.refresh();
    }
  }

  async function onRejectDocument(documentId: string) {
    const fd = new FormData();
    fd.set("document_id", documentId);
    fd.set("decision", "rejected");
    const result = await verifyTransactionDocument(fd);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Document rejected.");
      router.refresh();
    }
  }

  async function onVerifyPayment(paymentId: string) {
    const result = await verifyPayment(paymentId);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Payment verified.");
      router.refresh();
    }
  }

  async function onWaiveInstallment(installmentId: string) {
    const result = await markInstallmentWaived(installmentId);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Installment waived.");
      router.refresh();
    }
  }

  async function onApprovePaymentTerms() {
    const ptId = (paymentTerms as Record<string, unknown> | null)?.id as string | undefined;
    if (!ptId) return;
    const r = await approvePaymentTerms(ptId);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Terms approved.");
      router.refresh();
    }
  }

  async function onActivatePaymentTerms() {
    const ptId = (paymentTerms as Record<string, unknown> | null)?.id as string | undefined;
    if (!ptId) return;
    const r = await activatePaymentTerms(ptId);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Installments generated.");
      router.refresh();
    }
  }

  async function onRecordPaperwork(documentKind: string) {
    const fd = new FormData();
    fd.set("transaction_id", id);
    fd.set("document_kind", documentKind);
    const result = await recordPaperwork(fd);
    if (result.error) toast.error(result.error);
    else {
      toast.success(`${documentKind} recorded.`);
      router.refresh();
    }
  }

  async function onInstructRepossession(informantId: string, reason: string) {
    if (!informantId) {
      toast.error("Select a Confidential Informant.");
      return;
    }
    const fd = new FormData();
    fd.set("transaction_id", id);
    fd.set("informant_id", informantId);
    if (reason) fd.set("reason", reason);
    const result = await instructRepossession(fd);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Repossession instructed. A recovery field case was created.");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <TransactionOverviewV1
        id={id}
        kind={kind}
        state={state}
        vehicles={vehicles}
        purchaseDetails={purchaseDetails}
        sellDetails={sellDetails}
        vehicleRequests={vehicleRequests}
        customerName={customerName}
        openedAt={openedAt}
        completedAt={completedAt}
      />

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <TransactionPaymentProgressV1
            kind={kind}
            payments={payments}
            purchaseDetails={purchaseDetails}
            sellDetails={sellDetails}
            vehicleRequests={vehicleRequests}
            installmentAccount={installmentAccount}
          />
          <TransactionStatusTriageV1
            state={state}
            kind={kind}
            openedAt={openedAt}
            completedAt={completedAt}
            updatedAt={updatedAt}
            userRole={userRole}
            transitioning={transitioning}
            onTransition={doTransition}
          />
        </div>
        <TransactionDetailSidebarV1
          kind={kind}
          state={state}
          userRole={userRole}
          payments={payments}
          documents={documents}
          history={history}
          installmentAccount={installmentAccount}
          paymentTerms={paymentTerms}
          viewingArrangements={viewingArrangements}
          informants={informants}
          sellDetails={sellDetails}
          onRecordPayment={onRecordPayment}
          onReviewSell={onReviewSell}
          onUploadDocument={onUploadDocument}
          onVerifyDocument={onVerifyDocument}
          onRejectDocument={onRejectDocument}
          onApprovePaymentTerms={onApprovePaymentTerms}
          onActivatePaymentTerms={onActivatePaymentTerms}
          onRecordPaperwork={onRecordPaperwork}
          onWaiveInstallment={onWaiveInstallment}
          onInstructRepossession={onInstructRepossession}
        />
      </div>

      <TransactionPaymentsTableV1 payments={payments} onVerifyPayment={onVerifyPayment} />
    </div>
  );
}
