"use client";

import { useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { fileFieldExpense } from "@/app/(staff)/field-cases/sell-inspection-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { compressFormFiles } from "@/lib/uploads/compress-image";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;

// Each field worker logs an expense with its purpose and a receipt photo. Shared by every field case kind.
export function FieldExpensesCard({
  fieldCaseId,
  expenses,
  canFile,
  title = "Field expenses",
  description = "Log each expense with its purpose and attach the receipt.",
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
  const [purpose, setPurpose] = useState("");
  const proofRef = useRef<HTMLInputElement>(null);

  async function submit() {
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
    setPurpose("");
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
            <span>
              {String(expense.description)} · {formatCurrency(Number(expense.amount))}
            </span>
            <span className="text-muted-foreground text-xs">{expense.reimbursed_at ? "Reimbursed" : "Logged"}</span>
          </div>
        ))}
        {expenses.length === 0 ? <p className="text-muted-foreground">No expenses filed yet.</p> : null}
        {canFile ? (
          <div className="flex flex-col gap-2 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min="0"
                placeholder="Amount (₱)"
                aria-label="Expense amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Input
                placeholder="Purpose, e.g. Fuel and toll"
                aria-label="Expense purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
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
