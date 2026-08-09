"use client";
"use no memo";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { Car, Eye, MoreHorizontal, ReceiptText, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { transactionKindLabel } from "@/lib/transactions/labels";
import { TRANSACTION_STATE_LABELS, type TransactionState } from "@/lib/transactions/state-machine";
import { cn } from "@/lib/utils";

import { statusMeta, type TransactionRow } from "./transactions-data";

function StatusBadge({ status }: { readonly status: TransactionState }) {
  const meta = statusMeta[status];

  return (
    <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badgeClass)} variant="outline">
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {TRANSACTION_STATE_LABELS[status]}
    </Badge>
  );
}

function KindIcon({ kind }: { readonly kind: string }) {
  if (kind === "buy") return <Car className="size-4" />;
  if (kind === "sell") return <ReceiptText className="size-4" />;
  return <Search className="size-4" />;
}

export const transactionColumns: ColumnDef<TransactionRow>[] = [
  {
    id: "search",
    accessorFn: (row) => `${row.vehicleLabel} ${row.subLabel} ${row.kind}`,
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    id: "vehicle",
    accessorFn: (row) => row.vehicleLabel,
    header: "Vehicle",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <KindIcon kind={row.original.kind} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground text-sm">{row.original.vehicleLabel}</div>
          <div className="truncate text-muted-foreground text-sm">{row.original.subLabel}</div>
        </div>
      </div>
    ),
  },
  {
    id: "kind",
    accessorFn: (row) => transactionKindLabel(row.kind as never),
    filterFn: "equalsString",
    header: "Kind",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-sm">{transactionKindLabel(row.original.kind as never)}</div>
    ),
  },
  {
    id: "status",
    accessorFn: (row) => TRANSACTION_STATE_LABELS[row.status],
    filterFn: "equalsString",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "openedAt",
    accessorFn: (row) => row.openedTimestamp,
    header: "Opened",
    cell: ({ row }) => <div className="text-foreground text-sm">{row.original.openedAt}</div>,
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => <RowActions transaction={row.original} />,
  },
];

function RowActions({ transaction }: { readonly transaction: TransactionRow }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Open transaction actions"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href={`/my-transactions/${transaction.id}`} onClick={(event) => event.stopPropagation()}>
            <Eye className="mr-2 size-4" />
            View Details
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
