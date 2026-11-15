import { financingFullyPaid } from "./buy-flow";

export type Installment = { state: unknown; due_date?: unknown; amount_due?: unknown };

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

// A payment counts only once the Head Accountant has confirmed it. A rejected row never counts.
export function isConfirmedPayment(payment: PaymentRow): boolean {
  return Boolean(payment.verified_by) && !payment.rejected_at;
}

// What GCE has banked for this sale: confirmed payments only, of every kind.
export function confirmedPaymentTotal(payments: readonly PaymentRow[]): number {
  return payments.filter(isConfirmedPayment).reduce((total, payment) => total + Number(payment.amount ?? 0), 0);
}

// What the buyer has paid off the financed balance: the installments verifyPayment marked 'paid' when the
// Head Accountant confirmed their payment. That is the same figure confirmedPaymentTotal() sums, but read
// from the schedule; both are exposed so the page can show a discrepancy if one ever appears.
export function paidToDate(
  installments: readonly { state?: unknown; amount_due?: unknown }[],
  _payments: readonly PaymentRow[],
): number {
  return installments
    .filter((installment) => installment.state === "paid")
    .reduce((total, installment) => total + Number(installment.amount_due ?? 0), 0);
}

export function remainingBalance(totalFinanced: unknown, paid: number): number {
  return Math.max(0, Number(totalFinanced ?? 0) - paid);
}

// Recorded but neither confirmed nor refused, and not an unanswered PayMongo session.
export function isAwaitingConfirmation(payment: PaymentRow): boolean {
  return !payment.rejected_at && !payment.verified_by && !isOpenCheckout(payment);
}
