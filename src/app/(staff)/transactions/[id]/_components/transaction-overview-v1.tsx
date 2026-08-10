"use client";
"use no memo";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { paymentMethodLabel, TRANSACTION_STATE_LABELS, transactionKindLabel } from "@/lib/transactions/labels";
import type { TransactionState } from "@/lib/transactions/state-machine";
import { formatCurrency } from "@/lib/utils";

const stateTone: Record<TransactionState, string> = {
  pending: "border-muted/35 bg-muted/10 text-muted-foreground",
  under_review: "border-primary/35 bg-primary/10 text-primary",
  approved: "border-primary/35 bg-primary/10 text-primary",
  completed: "border-green-600/35 bg-green-600/10 text-green-600",
  rejected: "border-destructive/35 bg-destructive/10 text-destructive",
  cancelled: "border-muted/35 bg-muted/10 text-muted-foreground",
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
}) {
  const amount = purchaseDetails?.final_price ?? sellDetails?.offered_amount ?? vehicleRequests?.budget;
  const amountLabel = kind === "buy" ? "final price" : kind === "sell" ? "offered amount" : "budget";

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
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

        <div className="xl:col-span-2">
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
      </div>
    </div>
  );
}
