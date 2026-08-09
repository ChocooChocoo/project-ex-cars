import { TRANSACTION_STATE_LABELS, type TransactionState } from "@/lib/transactions/state-machine";

export interface TransactionRow {
  id: string;
  vehicleLabel: string;
  subLabel: string;
  kind: string;
  status: TransactionState;
  openedAt: string;
  openedTimestamp: number;
}

export const KIND_FILTER_OPTIONS = ["All", "Buy", "Sell", "Request a Car"] as const;
export const STATUS_FILTER_OPTIONS = ["All", ...Object.values(TRANSACTION_STATE_LABELS)] as const;

export const statusMeta: Record<TransactionState, { badgeClass: string; dotClass: string }> = {
  pending: {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  under_review: {
    badgeClass: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dotClass: "bg-sky-500",
  },
  approved: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  rejected: {
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  completed: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  cancelled: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
};
