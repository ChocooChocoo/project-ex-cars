import { Badge } from "@/components/ui/badge";
import { transactionStatusBadgeVariant } from "@/lib/transactions/labels";
import {
  FLOW_STATUS_LABELS,
  type FlowStatus,
  isOverdue,
  OVERDUE_LABEL,
  TRANSACTION_FLAG_LABELS,
  TRANSACTION_STATE_LABELS,
  type TransactionFlag,
  type TransactionState,
} from "@/lib/transactions/state-machine";

interface TransactionStatusBadgeProps {
  readonly state: TransactionState;
  readonly flowStatus?: FlowStatus | null;
  readonly flag?: TransactionFlag | null;
  readonly reviewDueAt?: string | null;
  readonly className?: string;
}

// One badge for a transaction's status: a flag explains the outcome, then an overdue review window,
// then the process-doc status, and the coarse state when no process status is set.
export function TransactionStatusBadge({
  state,
  flowStatus,
  flag,
  reviewDueAt,
  className,
}: TransactionStatusBadgeProps) {
  if (flag) {
    return (
      <Badge variant="destructive" className={className}>
        {TRANSACTION_FLAG_LABELS[flag]}
      </Badge>
    );
  }

  if (isOverdue({ current_state: state, review_due_at: reviewDueAt ?? null })) {
    return (
      <Badge variant="destructive" className={className}>
        {OVERDUE_LABEL}
      </Badge>
    );
  }

  return (
    <Badge variant={transactionStatusBadgeVariant(state)} className={className}>
      {flowStatus ? FLOW_STATUS_LABELS[flowStatus] : TRANSACTION_STATE_LABELS[state]}
    </Badge>
  );
}
