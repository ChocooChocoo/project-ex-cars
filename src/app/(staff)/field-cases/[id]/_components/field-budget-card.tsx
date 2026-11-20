"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { recordBudgetReturn, requestFieldBudget } from "@/app/(staff)/field-cases/budget-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  budgetExcessCents,
  budgetNoExcess,
  budgetReleased,
  expensesCents,
  FIELD_EXPENSE_CATEGORIES,
  fieldExpensePurpose,
} from "@/lib/transactions/field-budget";
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
// BH-5: "What it covers" is a category checklist, and finance keeps reading the joined labels from `purpose`.
// BH-3 / SN-2 / SH-11: a zero excess needs no return entry and no Head Accountant confirmation.
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
  const [categories, setCategories] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [returned, setReturned] = useState("");
  const live = budget && budget.status !== "rejected" ? budget : null;
  const releasedCents = live && budgetReleased(live.status) ? Number(live.amount_cents) : 0;
  const excess = budgetExcessCents(releasedCents, expenses) / 100;
  const noExcess = budgetNoExcess(releasedCents, expenses);
  const purpose = fieldExpensePurpose(categories, other);
  const otherTicked = categories.includes("other");

  function toggleCategory(value: string, checked: boolean) {
    setCategories((prev) => (checked ? [...new Set([...prev, value])] : prev.filter((c) => c !== value)));
  }

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

  async function requestBudget() {
    if (categories.length === 0) {
      toast.error("Tick what the budget covers.");
      return;
    }
    if (otherTicked && other.trim() === "") {
      toast.error("Say what the other expense is.");
      return;
    }
    const fd = new FormData();
    fd.set("field_case_id", fieldCaseId);
    fd.set("amount", amount);
    for (const category of categories) fd.append("categories[]", category);
    if (otherTicked) fd.set("other", other);
    setBusy(true);
    const result = await requestFieldBudget(fd);
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Budget requested.");
    setAmount("");
    setCategories([]);
    setOther("");
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
            {live.purpose ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">Covers</dt>
                <dd>{String(live.purpose)}</dd>
              </div>
            ) : null}
            {live.rejection_reason ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">Rejected</dt>
                <dd className="whitespace-pre-wrap break-words rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm">
                  Rejected: {String(live.rejection_reason)}
                </dd>
              </div>
            ) : null}
            {releasedCents > 0 ? (
              <>
                <div>
                  <dt className="text-muted-foreground text-xs">Expenses logged</dt>
                  <dd>{formatCurrency(expensesCents(expenses) / 100)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Excess to return</dt>
                  <dd>{excess > 0 ? formatCurrency(excess) : "No excess"}</dd>
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
        {/* BH-4: a rejected budget is hidden from the summary above, but the requester still reads why. */}
        {!live && budget?.status === "rejected" && budget.rejection_reason ? (
          <p className="whitespace-pre-wrap break-words rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm">
            Rejected: {String(budget.rejection_reason)}
          </p>
        ) : null}

        {isInformant && open && !live ? (
          <div className="flex flex-col gap-3">
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
            <fieldset className="flex flex-col gap-2">
              <legend className="font-medium text-sm">What it covers</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {FIELD_EXPENSE_CATEGORIES.map((category) => (
                  <div key={category.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={`budget-category-${category.value}`}
                      checked={categories.includes(category.value)}
                      onCheckedChange={(checked) => toggleCategory(category.value, checked === true)}
                    />
                    <label htmlFor={`budget-category-${category.value}`}>{category.label}</label>
                  </div>
                ))}
              </div>
              {otherTicked ? (
                <Input
                  aria-label="Other expense"
                  placeholder="What is the other expense?"
                  maxLength={100}
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                />
              ) : null}
              {purpose !== "" ? <p className="text-muted-foreground text-xs">Covers: {purpose}</p> : null}
            </fieldset>
            <Button size="sm" className="self-start" disabled={busy} onClick={requestBudget}>
              Request budget
            </Button>
          </div>
        ) : null}

        {isInformant && live && releasedCents > 0 && !live.returned_at ? (
          noExcess ? (
            // BH-3 / SN-2 / SH-11: nothing came back, so nothing is returned and no Head Accountant task is created.
            <div className="flex flex-col gap-2 border-t pt-3">
              <p className="text-muted-foreground">The receipts used the whole budget. No cash to return.</p>
              <Button
                size="sm"
                className="self-start"
                disabled={busy}
                onClick={() => send(recordBudgetReturn, { returned: "0" }, "No excess recorded.")}
              >
                No excess — mark completed
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2 border-t pt-3">
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
                  send(
                    recordBudgetReturn,
                    { returned: returned === "" ? String(excess) : returned },
                    "Return recorded.",
                  )
                }
              >
                Record excess returned
              </Button>
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
