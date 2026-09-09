"use client";
"use no memo";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { paymentMethodLabel, TRANSACTION_STATE_LABELS, transactionKindLabel } from "@/lib/transactions/labels";
import type { TransactionState } from "@/lib/transactions/state-machine";
import { cn, formatCurrency } from "@/lib/utils";

const stateTone: Record<TransactionState, string> = {
  pending: "border-muted/35 bg-muted/10 text-muted-foreground",
  under_review: "border-primary/35 bg-primary/10 text-primary",
  approved: "border-primary/35 bg-primary/10 text-primary",
  completed: "border-green-600/35 bg-green-600/10 text-green-600",
  rejected: "border-destructive/35 bg-destructive/10 text-destructive",
  cancelled: "border-muted/35 bg-muted/10 text-muted-foreground",
};

export type ApprovalStageStatus = "done" | "current" | "todo";

export interface ApprovalStage {
  readonly key: string;
  readonly label: string;
  readonly owner: string;
  readonly status: ApprovalStageStatus;
}

// Task 32 approval provenance: Processed (Sales) → Verified (HA) → Approved (CEO) → Sold.
// History/documents are optional so the ladder also works from state alone when the
// parent does not pass them (page.tsx is orchestrator-owned and cannot be edited here).
export function deriveApprovalStages(args: {
  readonly state: TransactionState;
  readonly kind?: string;
  readonly vehicles?: Record<string, unknown>;
  readonly purchaseDetails?: Record<string, unknown>;
  readonly history?: Record<string, unknown>[];
  readonly documents?: Record<string, unknown>[];
}): ApprovalStage[] {
  const { state, vehicles, purchaseDetails, history, documents } = args;
  const historyEntries = history ?? [];

  const hasProcessedHistory = historyEntries.some(
    (entry) => String(entry.from_state) === "pending" && String(entry.to_state) === "under_review",
  );
  // under_review/approved/completed/rejected are only reachable via pending → under_review,
  // so the state alone implies processing. Cancelled can come straight from pending.
  const processedDone = hasProcessedHistory || ["under_review", "approved", "completed", "rejected"].includes(state);

  let verifiedByDocs = false;
  if (documents) {
    const verifiedIds = documents.filter(
      (doc) => String(doc.document_kind) === "valid_id" && String(doc.verification_state) === "verified",
    ).length;
    const verifiedBilling = documents.filter(
      (doc) => String(doc.document_kind) === "proof_of_billing" && String(doc.verification_state) === "verified",
    ).length;
    verifiedByDocs = verifiedIds >= 2 && verifiedBilling >= 1;
  }
  const purchaseDocVerified = String(purchaseDetails?.document_check_state ?? "") === "verified";
  // Approval implies the documents were verified first: the server blocks
  // under_review → approved without 2 verified IDs + verified billing.
  const verifiedDone = verifiedByDocs || purchaseDocVerified || ["approved", "completed"].includes(state);

  const approvedDone =
    ["approved", "completed"].includes(state) || historyEntries.some((entry) => String(entry.to_state) === "approved");

  const listingState = typeof vehicles?.listing_state === "string" ? vehicles.listing_state : null;
  const soldDone = state === "completed" && (listingState ? listingState === "sold" : true);

  const dones = [processedDone, verifiedDone, approvedDone, soldDone];
  const firstTodo = dones.findIndex((done) => !done);

  const defs = [
    { key: "processed", label: "Processed", owner: "Sales" },
    { key: "verified", label: "Verified", owner: "Head Accountant" },
    { key: "approved", label: "Approved", owner: "CEO" },
    { key: "sold", label: "Sold", owner: "Completed" },
  ] as const;

  return defs.map((def, index) => ({
    ...def,
    status: dones[index] ? "done" : firstTodo === index ? "current" : "todo",
  }));
}

const stageTone: Record<ApprovalStageStatus, string> = {
  done: "border-green-600/35 bg-green-600/10 text-green-600",
  current: "border-primary/35 bg-primary/10 text-primary",
  todo: "border-muted/35 bg-muted/10 text-muted-foreground",
};

export function TransactionOverviewV1({
  id,
  kind,
  state,
  vehicles,
  purchaseDetails,
  sellDetails,
  vehicleRequests,
  customerName,
  openedAt,
  completedAt,
  history,
  documents,
}: {
  readonly id: string;
  readonly kind: string;
  readonly state: TransactionState;
  readonly vehicles: Record<string, unknown> | undefined;
  readonly purchaseDetails: Record<string, unknown> | undefined;
  readonly sellDetails: Record<string, unknown> | undefined;
  readonly vehicleRequests: Record<string, unknown> | undefined;
  readonly customerName: string | null;
  readonly openedAt: string;
  readonly completedAt: string | null;
  // Optional: page.tsx (orchestrator-owned) may pass these later; empty-state fallback when absent.
  readonly history?: Record<string, unknown>[];
  readonly documents?: Record<string, unknown>[];
}) {
  const amount = purchaseDetails?.final_price ?? sellDetails?.offered_amount ?? vehicleRequests?.budget;
  const amountLabel = kind === "buy" ? "final price" : kind === "sell" ? "offered amount" : "budget";
  const stages = deriveApprovalStages({ state, kind, vehicles, purchaseDetails, history, documents });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={stateTone[state]}>
            <span className="size-1.5 rounded-full bg-current" />
            {TRANSACTION_STATE_LABELS[state]}
          </Badge>
          <Badge variant="outline" className="font-medium">
            {transactionKindLabel(kind as never)}
          </Badge>
          <span className="text-muted-foreground text-sm">
            ·<span className="tabular-nums">{amount !== undefined ? formatCurrency(Number(amount)) : "—"}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Opened {format(new Date(openedAt), "MMM d, yyyy")}</span>
          {completedAt ? (
            <span className="text-muted-foreground text-xs">
              · Completed {format(new Date(completedAt), "MMM d, yyyy")}
            </span>
          ) : null}
        </div>
      </div>

      <Card className="shadow-xs">
        <CardHeader className="px-4">
          <CardTitle>Approval flow</CardTitle>
          <CardDescription>Processed (Sales) → Verified (HA) → Approved (CEO) → Sold</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            {stages.map((stage, index) => (
              <li key={stage.key} className={cn("rounded-md border px-2.5 py-2", stageTone[stage.status])}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs tabular-nums">Step {index + 1}</span>
                  <Badge variant="outline" className="h-5 px-2 text-[11px]">
                    {stage.status === "done" ? "Done" : stage.status === "current" ? "Current" : "Pending"}
                  </Badge>
                </div>
                <div className="font-semibold text-foreground text-sm">{stage.label}</div>
                <div className="text-muted-foreground text-xs">{stage.owner}</div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-2">
        <div className="text-muted-foreground text-sm">Vehicle</div>
        <div className="text-3xl tabular-nums tracking-tight sm:text-4xl">
          {vehicles ? `${String(vehicles.make)} ${String(vehicles.model)}` : "—"}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="font-medium tabular-nums">
            {vehicles?.year ? String(vehicles.year) : "No vehicle"}
          </Badge>
          <Badge variant="outline" className="font-medium tabular-nums">
            #{id.slice(0, 8)}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">Transaction details for this record.</p>
      </div>

      <Card className="shadow-xs">
        <CardHeader className="px-4">
          <CardTitle>Transaction summary</CardTitle>
          <CardDescription>Key facts across the transaction record.</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 space-y-1">
              <div className="text-muted-foreground text-sm">Customer</div>
              <div className="truncate font-semibold text-2xl tabular-nums">{customerName ?? "—"}</div>
              <div className="text-muted-foreground text-xs">customer profile</div>
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-muted-foreground text-sm">Amount</div>
              <div className="font-semibold text-2xl tabular-nums">
                {amount !== undefined ? formatCurrency(Number(amount)) : "—"}
              </div>
              <div className="text-muted-foreground text-xs">{amountLabel}</div>
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-muted-foreground text-sm">
                {kind === "buy" ? "Payment Method" : kind === "sell" ? "Valuation" : "Model"}
              </div>
              <div className="font-semibold text-2xl tabular-nums">
                {kind === "buy"
                  ? purchaseDetails?.payment_method
                    ? paymentMethodLabel(String(purchaseDetails.payment_method))
                    : "—"
                  : kind === "sell"
                    ? sellDetails?.valuation_amount
                      ? formatCurrency(Number(sellDetails.valuation_amount))
                      : "—"
                    : vehicleRequests?.requested_model
                      ? String(vehicleRequests.requested_model)
                      : "—"}
              </div>
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-muted-foreground text-sm">
                {kind === "buy" ? "Document Check" : kind === "sell" ? "Decision" : "Make"}
              </div>
              <div className="font-semibold text-2xl tabular-nums">
                {kind === "buy"
                  ? purchaseDetails?.document_check_state
                    ? String(purchaseDetails.document_check_state)
                    : "—"
                  : kind === "sell"
                    ? sellDetails?.decision
                      ? String(sellDetails.decision)
                      : "Pending"
                    : vehicleRequests?.requested_make
                      ? String(vehicleRequests.requested_make)
                      : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
