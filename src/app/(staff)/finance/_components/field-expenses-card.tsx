"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import { markExpenseReimbursed } from "@/app/(staff)/finance/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export interface FieldExpenseRow {
  id: string;
  amount: number;
  description: string;
  submitted_at: string;
  reimbursed_at: string | null;
  field_cases: {
    transaction_id: string | null;
    vehicles: { make: string; model: string; year: number; listing_state: string } | null;
  } | null;
}

// Selling step 13: meet-up expenses wait here until the car GCE bought is sold on.
export function FieldExpensesCard({
  expenses,
  canReimburse,
}: {
  readonly expenses: FieldExpenseRow[];
  readonly canReimburse: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reimburse(id: string) {
    setBusyId(id);
    const fd = new FormData();
    fd.set("expense_id", id);
    const result = await markExpenseReimbursed(fd);
    setBusyId(null);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Expense reimbursed.");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Field expenses awaiting reimbursement</CardTitle>
        <CardDescription>Reimbursable once the vehicle is marked sold. Proofs are on the transaction.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {expenses.length === 0 ? <p className="text-muted-foreground">No open field expenses.</p> : null}
        {expenses.map((expense) => {
          const vehicle = expense.field_cases?.vehicles;
          const sold = vehicle?.listing_state === "sold";
          const transactionId = expense.field_cases?.transaction_id;
          return (
            <div
              key={expense.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="font-medium">
                  {expense.description} · {formatCurrency(Number(expense.amount))}
                </span>
                <span className="text-muted-foreground text-xs">
                  {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "No vehicle"} · filed{" "}
                  {format(new Date(expense.submitted_at), "MMM d, yyyy")} · {sold ? "Vehicle sold" : "Not sold yet"}
                </span>
                {transactionId ? (
                  <Link href={`/dashboard/transactions/${transactionId}`} className="text-primary text-xs underline">
                    View proof on the transaction
                  </Link>
                ) : null}
              </div>
              {canReimburse ? (
                <Button size="sm" disabled={!sold || busyId === expense.id} onClick={() => reimburse(expense.id)}>
                  Mark reimbursed
                </Button>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
