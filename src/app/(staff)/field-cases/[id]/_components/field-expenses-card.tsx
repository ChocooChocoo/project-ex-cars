"use client";

import { useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { fileFieldExpense } from "@/app/(staff)/field-cases/sell-inspection-actions";
import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { expensesCents, FIELD_EXPENSE_CATEGORIES, fieldExpensePurpose } from "@/lib/transactions/field-budget";
import { compressFormFiles } from "@/lib/uploads/compress-image";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;

// SH-9: only the Confidential Informant files meet-up expenses and their proofs; the Mechanic reads them here.
// SN-6: the card's total is the sum of the filed rows, which is also what the case list shows.
// BH-5: the purpose is the same category checklist the budget card uses, stored as the joined labels.
export function FieldExpensesCard({
  fieldCaseId,
  expenses,
  canFile,
  title = "Field expenses",
  description = "The Confidential Informant logs each expense with its purpose and attaches the receipt.",
}: {
  readonly fieldCaseId: string;
  readonly expenses: Row[];
  readonly canFile: boolean;
  readonly title?: string;
  readonly description?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const proofRef = useRef<HTMLInputElement>(null);

  const total = expensesCents(expenses) / 100;
  const purpose = fieldExpensePurpose(categories, other);
  const otherTicked = categories.includes("other");

  function toggleCategory(value: string, checked: boolean) {
    setCategories((prev) => (checked ? [...new Set([...prev, value])] : prev.filter((c) => c !== value)));
  }

  async function submit() {
    if (categories.length === 0) {
      toast.error("Tick what the expense was for.");
      return;
    }
    if (otherTicked && other.trim() === "") {
      toast.error("Say what the other expense is.");
      return;
    }
    const fd = new FormData();
    fd.set("field_case_id", fieldCaseId);
    fd.set("amount", amount);
    fd.set("description", purpose);
    const proof = proofRef.current?.files?.[0];
    if (proof) fd.set("proof", proof);
    setBusy(true);
    const result = await fileFieldExpense(await compressFormFiles(fd));
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Expense filed.");
    setAmount("");
    setCategories([]);
    setOther("");
    if (proofRef.current) proofRef.current.value = "";
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {expenses.map((expense) => (
          <div
            key={expense.id as string}
            className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5"
          >
            <span className="flex min-w-0 items-center gap-2">
              {typeof expense.proof_url === "string" ? (
                <TransactionImagePreview
                  src={expense.proof_url}
                  alt={`Receipt for ${String(expense.description)}`}
                  triggerClassName="h-12 w-16"
                />
              ) : null}
              <span>
                {String(expense.description)} · {formatCurrency(Number(expense.amount))}
              </span>
            </span>
            <span className="text-muted-foreground text-xs">{expense.reimbursed_at ? "Reimbursed" : "Logged"}</span>
          </div>
        ))}
        {expenses.length === 0 ? <p className="text-muted-foreground">No expenses filed yet.</p> : null}
        {expenses.length > 0 ? (
          <p className="flex items-center justify-between border-t pt-2 font-medium">
            <span>Total expenses</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </p>
        ) : null}
        {canFile ? (
          <div className="flex flex-col gap-2 pt-2">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_1fr]">
              <Input
                type="number"
                min="0"
                placeholder="Amount (₱)"
                aria-label="Expense amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <legend className="sr-only">Purpose</legend>
                {FIELD_EXPENSE_CATEGORIES.map((category) => (
                  <div key={category.value} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      id={`expense-category-${category.value}`}
                      checked={categories.includes(category.value)}
                      onCheckedChange={(checked) => toggleCategory(category.value, checked === true)}
                    />
                    <label htmlFor={`expense-category-${category.value}`}>{category.label}</label>
                  </div>
                ))}
              </fieldset>
            </div>
            {otherTicked ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expense-other">Other expense</Label>
                <Input
                  id="expense-other"
                  placeholder="What is the other expense?"
                  maxLength={100}
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                />
              </div>
            ) : null}
            {purpose !== "" ? <p className="text-muted-foreground text-xs">Purpose: {purpose}</p> : null}
            <Input
              ref={proofRef}
              type="file"
              aria-label="Receipt photo"
              accept="image/jpeg,image/png,image/webp,application/pdf"
            />
            <Button size="sm" className="self-start" disabled={busy} onClick={submit}>
              File expense
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
