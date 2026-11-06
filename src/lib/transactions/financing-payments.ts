import { financingFullyPaid } from "./buy-flow";

type Installment = { state: unknown; due_date?: unknown; amount_due?: unknown };

export function unpaidInstallments<T extends Installment>(installments: readonly T[]): T[] {
  return installments
    .filter((installment) => !["paid", "waived"].includes(String(installment.state)))
    .sort((a, b) => String(a.due_date ?? "").localeCompare(String(b.due_date ?? "")));
}

export function nextUnpaidInstallment<T extends Installment>(installments: readonly T[]): T | null {
  return unpaidInstallments(installments)[0] ?? null;
}

export function paidInstallmentCount(installments: readonly Installment[]): number {
  return installments.filter((installment) => installment.state === "paid").length;
}

export function advancedPaymentTotal(installments: readonly Installment[]): number {
  return unpaidInstallments(installments).reduce(
    (total, installment) => total + Number(installment.amount_due ?? 0),
    0,
  );
}

export function canMarkFinancingSold(installments: readonly Installment[]): boolean {
  return financingFullyPaid(installments.map((installment) => ({ ...installment, due_date: installment.due_date })));
}
