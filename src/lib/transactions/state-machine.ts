// Pure state machine for Phase 5 transaction states (R-18).
// No I/O, no server imports — usable from both server actions and client UI.

export const TRANSACTION_STATES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "completed",
  "cancelled",
] as const;
export type TransactionState = (typeof TRANSACTION_STATES)[number];

export const TRANSACTION_KINDS = ["buy", "sell", "request_a_car"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const PAYMENT_METHODS = ["cash", "financing", "cheque", "down_payment"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ARRANGEMENT_KINDS = ["delivery", "meetup", "gce_visit"] as const;
export type ArrangementKind = (typeof ARRANGEMENT_KINDS)[number];

export const INSTALLMENT_STATES = ["upcoming", "due", "paid", "overdue", "waived"] as const;
export type InstallmentState = (typeof INSTALLMENT_STATES)[number];

export const PAYMENT_TERMS_STATES = ["proposed", "approved", "rejected", "active", "completed"] as const;
export type PaymentTermsState = (typeof PAYMENT_TERMS_STATES)[number];

export const FIELD_CASE_STATES = ["assigned", "accepted", "in_progress", "completed", "cancelled"] as const;
export type FieldCaseState = (typeof FIELD_CASE_STATES)[number];

export const COLLECTION_ACTION_KINDS = ["notice", "ultimatum", "recovery_instruction", "recovery_result"] as const;
export type CollectionActionKind = (typeof COLLECTION_ACTION_KINDS)[number];

// Staff roles that can transition transaction states.
type TransitionRole = "ceo" | "sales_manager" | "account_manager" | "head_accountant";

const S = ["sales_manager"] as TransitionRole[];
const C = ["ceo"] as TransitionRole[];
const A = ["account_manager"] as TransitionRole[];
const H = ["head_accountant"] as TransitionRole[];

const SCA = [...S, ...C, ...A];
const SC = [...S, ...C];
const SCH = [...S, ...C, ...H];

// TRANSITION_RULES[from][to] = roles allowed to make the transition.
export const TRANSITION_RULES: Record<
  TransactionState,
  Partial<Record<TransactionState, readonly TransitionRole[]>>
> = {
  pending: {
    under_review: SCA,
    cancelled: SCA,
  },
  under_review: {
    approved: SC,
    rejected: SC,
    cancelled: SC,
  },
  approved: {
    completed: SCH,
    cancelled: SC,
  },
  rejected: {},
  completed: {},
  cancelled: {},
};

export function canTransition(from: TransactionState, to: TransactionState, role: string): boolean {
  const allowed = TRANSITION_RULES[from]?.[to];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(role);
}

export function getAllowedTransitions(from: TransactionState, role: string): TransactionState[] {
  const rules = TRANSITION_RULES[from];
  if (!rules) return [];
  return (Object.entries(rules) as [TransactionState, readonly TransitionRole[]][])
    .filter(([, roles]) => (roles as readonly string[]).includes(role))
    .map(([state]) => state);
}

export function isTerminal(state: TransactionState): boolean {
  return state === "rejected" || state === "completed" || state === "cancelled";
}

export const TRANSACTION_STATE_LABELS: Record<TransactionState, string> = {
  pending: "Pending",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const INSTALLMENT_STATE_LABELS: Record<InstallmentState, string> = {
  upcoming: "Upcoming",
  due: "Due",
  paid: "Paid",
  overdue: "Overdue",
  waived: "Waived",
};

export const PAYMENT_TERMS_STATE_LABELS: Record<PaymentTermsState, string> = {
  proposed: "Proposed",
  approved: "Approved",
  rejected: "Rejected",
  active: "Active",
  completed: "Completed",
};

export const FIELD_CASE_STATE_LABELS: Record<FieldCaseState, string> = {
  assigned: "Assigned",
  accepted: "Accepted",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
