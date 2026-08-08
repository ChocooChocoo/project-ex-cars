// Shared display labels and badge variants for transaction UI.
// Used by both customer and staff components.

import type { TransactionKind } from "./state-machine";
import {
  FIELD_CASE_STATE_LABELS,
  type FieldCaseState,
  INSTALLMENT_STATE_LABELS,
  type InstallmentState,
  PAYMENT_TERMS_STATE_LABELS,
  type PaymentTermsState,
  TRANSACTION_STATE_LABELS,
  type TransactionState,
} from "./state-machine";

export function transactionKindLabel(kind: TransactionKind): string {
  const map: Record<TransactionKind, string> = {
    buy: "Buy",
    sell: "Sell",
    request_a_car: "Request a Car",
  };
  return map[kind];
}

export function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    cash: "Cash",
    financing: "Financing",
    cheque: "Cheque",
    down_payment: "Down Payment",
    bank_transfer: "Bank Transfer",
  };
  return map[method] ?? method;
}

export function arrangementKindLabel(kind: string): string {
  const map: Record<string, string> = {
    delivery: "Delivery",
    meetup: "CALABARZON Meet-up",
    gce_visit: "GCE Visit",
  };
  return map[kind] ?? kind;
}

// Returns a shadcn/ui Badge variant string for each transaction state.
export function transactionStatusBadgeVariant(
  state: TransactionState,
): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<TransactionState, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    under_review: "default",
    approved: "default",
    rejected: "destructive",
    completed: "default",
    cancelled: "outline",
  };
  return map[state];
}

export function installmentStatusBadgeVariant(
  state: InstallmentState,
): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<InstallmentState, "default" | "secondary" | "destructive" | "outline"> = {
    upcoming: "secondary",
    due: "default",
    paid: "default",
    overdue: "destructive",
    waived: "outline",
  };
  return map[state];
}

export function paymentTermsStatusBadgeVariant(
  state: PaymentTermsState,
): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<PaymentTermsState, "default" | "secondary" | "destructive" | "outline"> = {
    proposed: "secondary",
    approved: "default",
    rejected: "destructive",
    active: "default",
    completed: "default",
  };
  return map[state];
}

export function fieldCaseStatusBadgeVariant(
  state: FieldCaseState,
): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<FieldCaseState, "default" | "secondary" | "destructive" | "outline"> = {
    assigned: "secondary",
    accepted: "default",
    in_progress: "default",
    completed: "default",
    cancelled: "outline",
  };
  return map[state];
}

export { FIELD_CASE_STATE_LABELS, INSTALLMENT_STATE_LABELS, PAYMENT_TERMS_STATE_LABELS, TRANSACTION_STATE_LABELS };
