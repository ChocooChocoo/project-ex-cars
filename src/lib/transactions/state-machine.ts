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

// down_payment stays for old rows only; new forms offer bank_transfer (a downpayment is an amount, not a method).
export const PAYMENT_METHODS = ["cash", "financing", "cheque", "down_payment", "bank_transfer"] as const;
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

// Process-doc statuses (GCE Process Flows, Appendix B) layered over the coarse current_state.
// "Overdue — Awaiting Action" is not stored: it is derived from review_due_at by isOverdue().
export const FLOW_STATUSES = [
  "pending_ceo_approval",
  "pending_sm_approval",
  "approved_awaiting_buyer_decision",
  "gce_visit_scheduled_dp_pending",
  "purchase_claim",
  "potential_buyer",
  "initial_dp_awaiting_verification",
  "initial_dp_confirmed",
  "financing_active",
  "financing_completed",
  "repossessed",
  "sold",
] as const;
export type FlowStatus = (typeof FLOW_STATUSES)[number];

export const TRANSACTION_FLAGS = [
  "declined_by_buyer",
  "buyer_no_show",
  "buyer_unavailable",
  "flagged",
  "cancelled_unprofitable",
  "seller_refused",
] as const;
export type TransactionFlag = (typeof TRANSACTION_FLAGS)[number];

export const QUEUE_STATES = ["active", "on_hold"] as const;
export type QueueState = (typeof QUEUE_STATES)[number];

// Staff roles that can transition transaction states.
type TransitionRole = "ceo" | "sales_manager" | "account_manager" | "head_accountant";

const S = ["sales_manager"] as TransitionRole[];
const C = ["ceo"] as TransitionRole[];
const A = ["account_manager"] as TransitionRole[];
const H = ["head_accountant"] as TransitionRole[];

const SCA = [...S, ...C, ...A];
const SC = [...S, ...C];
const SCH = [...S, ...C, ...H];

// Task 32 client flow: Sales Manager processes, Head Accountant verifies,
// CEO approves/rejects, then the car is marked sold. CEO is the sole approver:
// under_review → approved/rejected is CEO-only (C). Sales "processing" is the
// pending → under_review step plus sell review input; verification happens via
// document/payment verification actions, not a separate state.
export const TRANSITION_RULES: Record<
  TransactionState,
  Partial<Record<TransactionState, readonly TransitionRole[]>>
> = {
  pending: {
    under_review: SCA,
    cancelled: SCA,
  },
  under_review: {
    approved: C,
    rejected: C,
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

// Review window lapsed without a decision. Decisions clear review_due_at; nothing auto-cancels.
export function isOverdue(
  tx: { current_state: TransactionState; review_due_at: string | null },
  now: Date = new Date(),
): boolean {
  if (!tx.review_due_at || isTerminal(tx.current_state)) return false;
  return now.getTime() > new Date(tx.review_due_at).getTime();
}

export const REVIEW_WINDOW_DAYS = 7;

// Due date of a review window opened at `from` (Pending CEO / Sales Manager approval).
export function reviewDueAt(from: Date = new Date()): string {
  return new Date(from.getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export const CANCEL_CUTOFF_HOURS = 5;

// Buyers may cancel a scheduled meetup or delivery only at least 5 hours before it.
export function canCancelScheduled(scheduledAt: string | Date, now: Date = new Date()): boolean {
  return new Date(scheduledAt).getTime() - now.getTime() >= CANCEL_CUTOFF_HOURS * 60 * 60 * 1000;
}

// A new request is Active only when no other request for the car is Active; otherwise it waits On Hold.
export function nextQueueState(hasActiveRequest: boolean): QueueState {
  return hasActiveRequest ? "on_hold" : "active";
}

export const FLOW_STATUS_LABELS: Record<FlowStatus, string> = {
  pending_ceo_approval: "Pending CEO Approval",
  pending_sm_approval: "Pending Sales Manager Approval",
  approved_awaiting_buyer_decision: "Approved — Awaiting Buyer Decision",
  gce_visit_scheduled_dp_pending: "GCE Visit Scheduled — Initial Downpayment Pending",
  purchase_claim: "Purchase Claim",
  potential_buyer: "Potential Buyer",
  initial_dp_awaiting_verification: "Initial Downpayment — Awaiting Verification",
  initial_dp_confirmed: "Initial Downpayment — Confirmed",
  financing_active: "In-House Financing — Active",
  financing_completed: "In-House Financing — Completed",
  repossessed: "Repossessed / Recovered by GCE",
  sold: "Sold",
};

export const TRANSACTION_FLAG_LABELS: Record<TransactionFlag, string> = {
  declined_by_buyer: "Declined by Buyer",
  buyer_no_show: "Buyer Didn't Show Up",
  buyer_unavailable: "Buyer Unavailable",
  flagged: "Flagged",
  cancelled_unprofitable: "Cancelled — Not Profitable",
  seller_refused: "Seller Refused",
};

export const OVERDUE_LABEL = "Overdue — Awaiting Action";

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
