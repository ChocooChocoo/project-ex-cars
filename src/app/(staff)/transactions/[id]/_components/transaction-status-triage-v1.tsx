"use client";
"use no memo";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canRecordNoShow } from "@/lib/transactions/buy-flow";
import { TRANSACTION_STATE_LABELS, transactionKindLabel } from "@/lib/transactions/labels";
import { getAllowedTransitions, type TransactionState } from "@/lib/transactions/state-machine";
import { cn } from "@/lib/utils";

const stateTone: Record<TransactionState, string> = {
  pending: "border-muted/35 bg-muted/10 text-muted-foreground",
  under_review: "border-primary/35 bg-primary/10 text-primary",
  approved: "border-primary/35 bg-primary/10 text-primary",
  completed: "border-green-600/35 bg-green-600/10 text-green-600",
  rejected: "border-destructive/35 bg-destructive/10 text-destructive",
  cancelled: "border-muted/35 bg-muted/10 text-muted-foreground",
};

const TRANSACTION_ACTION_LABELS: Record<TransactionState, string> = {
  pending: "Move to Pending",
  under_review: "Move to Review",
  approved: "Approve",
  rejected: "Reject",
  completed: "Mark Sold to This Buyer",
  cancelled: "Cancel",
};

// GCE Process Flows §2 (T01 Q0a): the buyer submits → the Sales Manager verifies the documents and
// approves or rejects within 7 days → the buyer visits → Mark Sold to This Buyer once paid.
const STATE_GUIDANCE: Record<TransactionState, (kind: string) => string> = {
  pending: (kind) => `This ${kind} request is still with the buyer, or waits for Sales to move it into review.`,
  under_review: (kind) =>
    `This ${kind} request is waiting for the Sales Manager (7-day window). Verify 2 valid IDs and the proof of billing, then approve or reject.`,
  approved: (kind) =>
    `This ${kind} request is approved. After the visit, record the payment and mark the car sold, or record that the buyer declined.`,
  rejected: (kind) => `This ${kind} request was rejected and its visit slot released.`,
  cancelled: (kind) => `This ${kind} transaction was cancelled and can no longer be advanced.`,
  completed: (kind) => `This ${kind} transaction is completed and the car is marked sold. All required steps are done.`,
};

export type VisitOutcome = "declined" | "legit" | "not_legit" | "no_show";

export function TransactionStatusTriageV1({
  state,
  kind,
  openedAt,
  completedAt,
  updatedAt,
  userRole,
  transitioning,
  onTransition,
  visit = null,
  onVisitOutcome,
}: {
  readonly state: TransactionState;
  readonly kind: string;
  readonly openedAt: string;
  readonly completedAt: string | null;
  readonly updatedAt: string;
  readonly userRole: string;
  readonly transitioning: boolean;
  readonly onTransition: (to: TransactionState) => Promise<void>;
  readonly visit?: { kind: string; schedule: string } | null;
  readonly onVisitOutcome?: (outcome: VisitOutcome) => Promise<void>;
}) {
  const daysOpen = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 86_400_000));
  const allowed = getAllowedTransitions(state, userRole);
  const canRecordOutcome = kind === "buy" && state === "approved" && ["sales_manager", "ceo"].includes(userRole);
  // §3 steps 6–7: a Meet Halfway decline is classified; a no-show is allowed 2h30m after the meet-up.
  const halfway = visit?.kind === "meetup";
  const outcomes: { outcome: VisitOutcome; label: string; detail: string }[] = !canRecordOutcome
    ? []
    : halfway
      ? [
          { outcome: "legit", label: "Declined — Legit", detail: "Legitimate surprise; no penalty" },
          { outcome: "not_legit", label: "Declined — Not Legit", detail: "Strike; buyer limited to GCE visits" },
          ...(visit && canRecordNoShow(visit.schedule)
            ? [{ outcome: "no_show" as const, label: "Buyer didn't show up", detail: "Counts as one no-show" }]
            : []),
        ]
      : [{ outcome: "declined", label: "Buyer declined", detail: "Close the request; the car stays listed" }];

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Status Triage</CardTitle>
        <CardDescription>Decision ladder for this transaction.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("rounded-md font-medium", stateTone[state])}>
            <span className="size-1.5 rounded-full bg-current" />
            {TRANSACTION_STATE_LABELS[state]}
          </Badge>
          <Badge variant="outline" className="font-medium">
            {transactionKindLabel(kind as never)}
          </Badge>
          <Badge variant="outline" className="font-medium tabular-nums">
            {daysOpen}d open
          </Badge>
          {completedAt ? (
            <Badge variant="outline" className="font-medium tabular-nums">
              Completed {format(new Date(completedAt), "MMM d")}
            </Badge>
          ) : null}
        </div>

        <p className="text-muted-foreground text-xs">{STATE_GUIDANCE[state](kind)}</p>

        {allowed.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {allowed.map((to) => (
              <button
                key={to}
                type="button"
                disabled={transitioning}
                onClick={() => onTransition(to)}
                className="space-y-1 rounded-md border bg-muted/20 px-2.5 py-2 text-left transition-colors hover:bg-muted/35 disabled:opacity-50"
              >
                <div className="text-muted-foreground text-xs">Transition</div>
                <div className="font-semibold text-sm capitalize">{TRANSACTION_ACTION_LABELS[to]}</div>
                <div className="text-muted-foreground text-xs">
                  Mark as {TRANSACTION_STATE_LABELS[to].toLowerCase()}
                </div>
              </button>
            ))}
            {onVisitOutcome
              ? outcomes.map((item) => (
                  <button
                    key={item.outcome}
                    type="button"
                    disabled={transitioning}
                    onClick={() => onVisitOutcome(item.outcome)}
                    className="space-y-1 rounded-md border bg-muted/20 px-2.5 py-2 text-left transition-colors hover:bg-muted/35 disabled:opacity-50"
                  >
                    <div className="text-muted-foreground text-xs">Visit outcome</div>
                    <div className="font-semibold text-sm">{item.label}</div>
                    <div className="text-muted-foreground text-xs">{item.detail}</div>
                  </button>
                ))
              : null}
          </div>
        ) : (
          <div className="space-y-1 rounded-md border border-dashed bg-muted/10 px-3 py-2.5">
            <p className="text-muted-foreground text-xs">
              No transitions:{" "}
              <span className="font-medium text-foreground">this transaction is in a terminal state.</span>
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              Opened:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {format(new Date(openedAt), "MMM d, yyyy")}
              </span>
            </span>
            <span className="text-muted-foreground">
              Completed:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {completedAt ? format(new Date(completedAt), "MMM d, yyyy") : "—"}
              </span>
            </span>
            <span className="text-muted-foreground">
              Last updated:{" "}
              <span className="font-medium text-foreground">{format(new Date(updatedAt), "MMM d, yyyy")}</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
