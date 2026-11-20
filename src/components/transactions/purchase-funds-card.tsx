"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { recordBudgetReturn } from "@/app/(staff)/field-cases/budget-actions";
import { recordSellerPaid, requestPurchaseFunds } from "@/app/(staff)/finance/actions";
import { ExcessReturnChoice } from "@/components/transactions/excess-return-choice";
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
// SH-5: every figure here is `sell_details.agreed_price` — the price agreed in the second negotiation, never the
// approved ceiling. A fund requested before that renegotiation still pays the final price, and the difference
// (plus unspent travel) is the excess to return.
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
  vehicle = null,
  seller = null,
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
  /** Notes line 164: the car being processed and its seller, so the fund and its return name them. */
  readonly vehicle?: Row | null;
  readonly seller?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [travel, setTravel] = useState("");
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
        {vehicle || seller ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            {vehicle ? (
              <div>
                <dt className="text-muted-foreground text-xs">Vehicle</dt>
                <dd>
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                  {vehicle.stock_code ? (
                    <span className="block text-muted-foreground text-xs">{String(vehicle.stock_code)}</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {seller ? (
              <div>
                <dt className="text-muted-foreground text-xs">Seller</dt>
                <dd>{seller}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
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
                <dd>{excess > 0 ? formatCurrency(excess) : "No excess"}</dd>
              </div>
            ) : null}
            {fund.rejection_reason ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">Rejected</dt>
                <dd className="whitespace-pre-wrap break-words rounded-md border border-destructive/40 bg-destructive/5 p-2">
                  Rejected: {String(fund.rejection_reason)}
                </dd>
              </div>
            ) : null}
            {fund.returned_at ? (
              <div>
                <dt className="text-muted-foreground text-xs">Returned</dt>
                <dd>
                  {Number(fund.returned_cents ?? 0) === 0 ? (
                    "No excess"
                  ) : (
                    <>
                      {formatCurrency(Number(fund.returned_cents ?? 0) / 100)} ·{" "}
                      {fund.return_confirmed_at ? "confirmed" : "waiting for the Head Accountant"}
                    </>
                  )}
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
        {/* BH-3 / SN-2 / SH-11 and notes lines 209-213: the requester says whether anything is left. */}
        {isRequester && fund && released && !fund.returned_at ? (
          <ExcessReturnChoice
            idPrefix="funds-return"
            excess={excess}
            busy={busy}
            onRecord={(value) =>
              send(
                recordBudgetReturn,
                { field_case_id: fieldCaseId, returned: value },
                value === "0" ? "No excess recorded." : "Return recorded.",
              )
            }
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
