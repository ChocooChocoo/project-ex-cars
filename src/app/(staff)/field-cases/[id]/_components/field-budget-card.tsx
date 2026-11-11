"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { recordBudgetReturn, requestFieldBudget } from "@/app/(staff)/field-cases/budget-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { budgetExcessCents, budgetReleased, expensesCents } from "@/lib/transactions/field-budget";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;
type Result = { error: string } | { success: true };

const STATUS_LABELS: Record<string, string> = {
  draft: "Waiting for the Head Accountant",
  submitted: "Waiting for the Head Accountant",
  approved: "Approved, not released yet",
  released: "Released",
  received: "Released",
  paid: "Released",
  rejected: "Rejected",
};

// T10: the Confidential Informant requests estimated expenses before leaving, then returns the excess.
export function FieldBudgetCard({
  fieldCaseId,
  budget,
  expenses,
  isInformant,
  open,
  description = "Request the estimated expenses from the Head Accountant before leaving. Return what the receipts did not use when you are back at GCE.",
}: {
  readonly fieldCaseId: string;
  readonly budget: Row | null;
  readonly expenses: Row[];
  readonly isInformant: boolean;
  readonly open: boolean;
  readonly description?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [returned, setReturned] = useState("");
  const live = budget && budget.status !== "rejected" ? budget : null;
  const releasedCents = live && budgetReleased(live.status) ? Number(live.amount_cents) : 0;
  const excess = budgetExcessCents(releasedCents, expenses) / 100;

  async function send(action: (fd: FormData) => Promise<Result>, fields: Record<string, string>, message: string) {
    const fd = new FormData();
    fd.set("field_case_id", fieldCaseId);
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
        <CardTitle>Field budget</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {live ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Requested</dt>
              <dd>{formatCurrency(Number(live.amount_cents) / 100)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Status</dt>
              <dd>
                <Badge variant="outline">{STATUS_LABELS[String(live.status)] ?? String(live.status)}</Badge>
              </dd>
            </div>
            {releasedCents > 0 ? (
              <>
                <div>
                  <dt className="text-muted-foreground text-xs">Expenses logged</dt>
                  <dd>{formatCurrency(expensesCents(expenses) / 100)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Excess to return</dt>
                  <dd>{formatCurrency(excess)}</dd>
                </div>
              </>
            ) : null}
            {live.returned_at ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">Returned</dt>
                <dd>
                  {formatCurrency(Number(live.returned_cents ?? 0) / 100)} ·{" "}
                  {live.return_confirmed_at ? "confirmed by the Head Accountant" : "waiting for the Head Accountant"}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-muted-foreground">
            {budget?.status === "rejected" ? "The last request was rejected. Request again." : "No budget requested."}
          </p>
        )}

        {isInformant && open && !live ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budget-amount">Estimated expenses (₱)</Label>
              <Input
                id="budget-amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budget-purpose">What it covers</Label>
              <Input
                id="budget-purpose"
                placeholder="Fuel, toll, meals"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={() => send(requestFieldBudget, { amount, purpose }, "Budget requested.")}
            >
              Request budget
            </Button>
          </div>
        ) : null}

        {isInformant && live && releasedCents > 0 && !live.returned_at ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budget-returned">Cash returned (₱)</Label>
              <Input
                id="budget-returned"
                type="number"
                min="0"
                placeholder={String(excess)}
                value={returned}
                onChange={(e) => setReturned(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                send(recordBudgetReturn, { returned: returned === "" ? String(excess) : returned }, "Return recorded.")
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
