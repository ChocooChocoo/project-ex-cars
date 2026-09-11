import { format } from "date-fns";

import { transactionKindLabel } from "@/lib/transactions/labels";
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

/**
 * Maps raw `transactions` rows (with an embedded `vehicles` relation) to table rows.
 * The two lines must never repeat: a row with no linked vehicle used to show the kind
 * label on both, e.g. "Request a Car" over "Request a Car".
 */
export function buildTransactionRows(transactions: Record<string, unknown>[]): TransactionRow[] {
  return transactions.map((tx) => {
    const vehicles = tx.vehicles as Record<string, unknown> | null | undefined;
    const kind = tx.transaction_kind as string;
    const openedAt = tx.opened_at as string;
    const id = tx.id as string;
    // Build the name from the parts that exist: a joined-but-empty vehicle row must
    // degrade to the kind label rather than render "()" or "undefined".
    const nameParts = [vehicles?.make, vehicles?.model].filter(Boolean).join(" ");
    const yearPart = vehicles?.year ? `(${vehicles.year})` : "";
    const vehicleName = [nameParts, yearPart].filter(Boolean).join(" ").trim();
    const stockCode = vehicles?.stock_code;

    return {
      id,
      vehicleLabel: vehicleName || transactionKindLabel(kind as never),
      subLabel: stockCode ? `Stock ${stockCode as string}` : `#${id.slice(0, 8)}`,
      kind,
      status: (tx.current_state ?? "pending") as TransactionState,
      openedAt: format(new Date(openedAt), "dd MMM yyyy"),
      openedTimestamp: new Date(openedAt).getTime(),
    };
  });
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
