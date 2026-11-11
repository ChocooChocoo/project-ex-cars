"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { recordBudgetReturn } from "@/app/(staff)/field-cases/budget-actions";
import { recordSellerPaid, requestPurchaseFunds } from "@/app/(staff)/finance/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { budgetReleased, expensesCents } from "@/lib/transactions/field-budget";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;
type Result = { error: string } | { success: true };

const STATUS_LABELS: Record<string, string> = {
  draft: "Waiting for the Head Accountant",
  submitted: "Waiting for the Head Accountant",
  approved: "Approved, not released yet",
  released: "Released to you",
  received: "Released to you",
  paid: "Seller paid",
};

/** T10: what the requester owes back: released cash less the seller's payment (once made) and logged expenses. */
export function purchaseExcessCents(fund: Row | null, agreedPrice: number, expenses: readonly Row[]): number {
  if (!fund || !budgetReleased(fund.status)) return 0;
  const paidSeller = fund.status === "paid" ? Math.round(agreedPrice * 100) : 0;
  return Math.max(0, Number(fund.amount_cents) - paidSeller - expensesCents(expenses));
}

// T10 Selling funds: the Marketing Specialist (GCE Visit) or the Confidential Informant (Meet Halfway) requests
// the car payment (plus travel on a Meet Halfway), pays the seller once the car is cleared, and returns the excess.
export function PurchaseFundsCard({
  transactionId,
  fieldCaseId,
  fund,
  agreedPrice,
  halfway,
  expenses,
  canRequest,
  isRequester,
  cleared,
}: {
  readonly transactionId: string;
  readonly fieldCaseId: string;
  readonly fund: Row | null;
  readonly agreedPrice: number;
  readonly halfway: boolean;
  readonly expenses: Row[];
  readonly canRequest: boolean;
  readonly isRequester: boolean;
  readonly cleared: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [travel, setTravel] = useState("");
  const [returned, setReturned] = useState("");
  const excess = purchaseExcessCents(fund, agreedPrice, expenses) / 100;
  const released = fund ? budgetReleased(fund.status) : false;

  async function send(action: (fd: FormData) => Promise<Result>, fields: Record<string, string>, message: string) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(fields)) fd.set(key, value);
    setBusy(true);
    const result = await action(fd);
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(message);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase funds</CardTitle>
        <CardDescription>
          {halfway
            ? "The Confidential Informant requests the car payment and the estimated travel budget from the Head Accountant."
            : "The Marketing Specialist requests the car payment from the Head Accountant."}{" "}
          Pay the seller once the car is cleared, then return what is left.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {fund ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Requested</dt>
              <dd>
                {formatCurrency(Number(fund.amount_cents) / 100)}
                {fund.purpose ? (
                  <span className="block text-muted-foreground text-xs">{String(fund.purpose)}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Status</dt>
              <dd>
                <Badge variant="outline">{STATUS_LABELS[String(fund.status)] ?? String(fund.status)}</Badge>
              </dd>
            </div>
            {released ? (
              <div>
                <dt className="text-muted-foreground text-xs">Excess to return</dt>
                <dd>{formatCurrency(excess)}</dd>
              </div>
            ) : null}
            {fund.returned_at ? (
              <div>
                <dt className="text-muted-foreground text-xs">Returned</dt>
                <dd>
                  {formatCurrency(Number(fund.returned_cents ?? 0) / 100)} ·{" "}
                  {fund.return_confirmed_at ? "confirmed" : "waiting for the Head Accountant"}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-muted-foreground">No funds requested yet. Car payment: {formatCurrency(agreedPrice)}.</p>
        )}

        {canRequest && !fund ? (
          <div className="flex flex-wrap items-end gap-2">
            {halfway ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="travel-budget">Estimated travel expenses (₱)</Label>
                <Input
                  id="travel-budget"
                  type="number"
                  min="0"
                  value={travel}
                  onChange={(e) => setTravel(e.target.value)}
                />
              </div>
            ) : null}
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                send(
                  requestPurchaseFunds,
                  { transaction_id: transactionId, travel_cents: String(Math.round(Number(travel || 0) * 100)) },
                  "Funds requested from the Head Accountant.",
                )
              }
            >
              Request funds
            </Button>
          </div>
        ) : null}

        {isRequester && fund && released && fund.status !== "paid" ? (
          cleared ? (
            <Button
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={() => send(recordSellerPaid, { disbursement_id: String(fund.id) }, "Seller payment recorded.")}
            >
              Record seller paid ({formatCurrency(agreedPrice)})
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs">Pay the seller once the inspection clears the car.</p>
          )
        ) : null}

        {isRequester && fund && released && !fund.returned_at ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="funds-returned">Cash returned (₱)</Label>
              <Input
                id="funds-returned"
                type="number"
                min="0"
                placeholder={String(excess)}
                value={returned}
                onChange={(e) => setReturned(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                send(
                  recordBudgetReturn,
                  { field_case_id: fieldCaseId, returned: returned === "" ? String(excess) : returned },
                  "Return recorded.",
                )
              }
            >
              Record excess returned
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
