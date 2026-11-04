"use client";

import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AFFORDABLE_INCOME_SHARE, computeLoan } from "@/lib/transactions/loan-calculator";
import { formatCurrency } from "@/lib/utils";

const peso = (n: number) => formatCurrency(n, { noDecimals: true });
const amount = (value: string) => Math.max(0, Number(value) || 0);

// T06: GCE financing loan calculator, after Motortrade's: income, price, downpayment, registration and docs
// stamp in; the monthly payment for each term and a loan eligibility estimate out.
export function LoanCalculator({
  price,
  markupPct,
  selectedMonths,
}: {
  readonly price: number;
  readonly markupPct: number;
  readonly selectedMonths?: number | null;
}) {
  const id = useId();
  const [income, setIncome] = useState("");
  const [registration, setRegistration] = useState("");
  const [docsStamp, setDocsStamp] = useState("");
  const loan = computeLoan({
    price,
    markupPct,
    monthlyIncome: amount(income),
    registration: amount(registration),
    docsStamp: amount(docsStamp),
  });
  const fields = [
    { key: "income", label: "Estimated monthly income (₱)", value: income, set: setIncome },
    { key: "registration", label: "Registration (₱)", value: registration, set: setRegistration },
    { key: "docs", label: "Docs stamp (₱)", value: docsStamp, set: setDocsStamp },
  ];

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-md border p-3">
      <div>
        <h3 id={`${id}-title`} className="font-medium text-sm">
          Loan calculator
        </h3>
        <p className="text-muted-foreground text-xs">
          Vehicle price {peso(price)} · Downpayment {peso(loan.downPayment)} (10%) · Financing adds {markupPct}%.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-${field.key}`} className="text-xs">
              {field.label}
            </Label>
            <Input
              id={`${id}-${field.key}`}
              type="number"
              inputMode="decimal"
              min={0}
              value={field.value}
              onChange={(event) => field.set(event.target.value)}
            />
          </div>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Term</TableHead>
            <TableHead className="text-right">Monthly</TableHead>
            <TableHead className="text-right">Eligibility</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loan.terms.map((term) => (
            <TableRow key={term.months} data-state={term.months === selectedMonths ? "selected" : undefined}>
              <TableCell>{term.months} months</TableCell>
              <TableCell className="text-right tabular-nums">{peso(term.monthly)}</TableCell>
              <TableCell className="text-right">
                {amount(income) > 0 ? (
                  <Badge variant={term.eligible ? "default" : "outline"}>{term.eligible ? "Likely" : "Stretch"}</Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">Enter income</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-muted-foreground text-xs">
        Cash needed upfront: {peso(loan.cashOut)} (downpayment, registration and docs stamp). Financed balance:{" "}
        {peso(loan.financed)}. "Likely" means the payment is at most {AFFORDABLE_INCOME_SHARE * 100}% of your income.
        This is an estimate; GCE confirms the final terms.
      </p>
    </section>
  );
}
