import { financingFullyPaid } from "./buy-flow";

type Installment = { state: unknown; due_date?: unknown; amount_due?: unknown };

type PaymentRow = Record<string, unknown>;

// A PayMongo session the buyer opened but never paid. It is not a payment, so no history lists it.
export function isOpenCheckout(payment: PaymentRow): boolean {
  return Boolean(
    payment.paymongo_checkout_id &&
      !payment.paymongo_payment_id &&
      !payment.paid_at &&
      !payment.verified_by &&
      !payment.rejected_at,
  );
}

// "Installment #2 (due 2027-01-10)" for an installment row, else the payment kind. One Advanced Payment
// covers several installments, one row each; naming the installment keeps them from reading as a double.
export function paymentPurposeLabel(
  payment: PaymentRow,
  installments: readonly PaymentRow[],
  kindLabel: (kind: string | null | undefined) => string,
): string {
  const installment = payment.installment_id
    ? installments.find((item) => item.id === payment.installment_id)
    : undefined;
  if (installment) return `Installment #${String(installment.sequence_no)} (due ${String(installment.due_date)})`;
  return kindLabel((payment.payment_kind as string | null) ?? null);
}

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
