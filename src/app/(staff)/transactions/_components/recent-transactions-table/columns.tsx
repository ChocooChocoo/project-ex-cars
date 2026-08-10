"use client";
"use no memo";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { differenceInCalendarDays, endOfToday, format, parseISO } from "date-fns";
import { CircleCheck, CircleDollarSign, Clock3, Eye, MoreHorizontal, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TRANSACTION_STATE_LABELS, transactionKindLabel } from "@/lib/transactions/labels";
import { getAllowedTransitions, type TransactionState } from "@/lib/transactions/state-machine";

import type { TransactionRow } from "./schema";

export const TRANSACTION_ACTION_LABELS: Record<TransactionState, string> = {
  pending: "Pending",
  under_review: "Under Review",
  approved: "Approve",
  rejected: "Reject",
  completed: "Complete",
  cancelled: "Cancel",
};

function kindIcon(kind: string) {
  switch (kind) {
    case "buy":
      return <CircleCheck className="fill-green-500 stroke-primary-foreground dark:fill-green-600" />;
    case "sell":
      return <CircleDollarSign className="text-amber-600 dark:text-amber-500" />;
    case "request_a_car":
      return <Clock3 className="text-muted-foreground" />;
    default:
      return null;
  }
}

export function createTransactionColumns(
  userRole: string,
  onTransitionRequest: (target: { id: string; to: TransactionState }) => void,
): ColumnDef<TransactionRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all transactions on this page"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.customerName}`}
          />
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md border bg-muted">
            <UserRound className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-end justify-between gap-3">
              <div className="grid min-w-0 gap-0.5">
                <span className="truncate font-medium text-sm leading-none">{row.original.customerName}</span>
                <span className="truncate text-muted-foreground text-xs leading-none">
                  #{row.original.id.slice(0, 8)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "search",
      accessorFn: (row) =>
        `${row.id} ${row.customerName} ${row.customerEmail} ${row.vehicleMake} ${row.vehicleModel} ${row.vehicleYear} ${row.kind} ${row.state}`,
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      accessorKey: "state",
      header: "Status",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {TRANSACTION_STATE_LABELS[row.original.state as TransactionState]}
        </Badge>
      ),
    },
    {
      accessorKey: "kind",
      header: "Billing",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {kindIcon(row.original.kind)}
          {transactionKindLabel(row.original.kind as never)}
        </Badge>
      ),
    },
    {
      id: "vehicle",
      header: "Plan",
      cell: ({ row }) =>
        row.original.vehicleMake ? (
          <span className="text-sm">
            {row.original.vehicleMake} {row.original.vehicleModel} {row.original.vehicleYear}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "openedWindow",
      accessorFn: (row) => {
        const daysSinceOpened = differenceInCalendarDays(endOfToday(), parseISO(row.openedAt));

        if (daysSinceOpened <= 30) return ["30", "90"];
        if (daysSinceOpened <= 90) return ["90"];
        return [];
      },
      filterFn: "arrIncludes",
      enableHiding: true,
    },
    {
      accessorKey: "openedAt",
      header: "Joined",
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <span className="text-sm">{format(parseISO(row.original.openedAt), "do MMMM yyyy")}</span>
          <span className="text-muted-foreground text-xs">at {format(parseISO(row.original.openedAt), "h:mm a")}</span>
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const id = row.original.id;
        const state = row.original.state as TransactionState;
        const allowed = getAllowedTransitions(state, userRole);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Open transaction actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/transactions/${id}`}>
                  <Eye className="mr-2 size-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              {allowed.length > 0 ? <DropdownMenuSeparator /> : null}
              {allowed.map((to) => (
                <DropdownMenuItem
                  key={to}
                  variant={to === "cancelled" || to === "rejected" ? "destructive" : "default"}
                  onClick={() => onTransitionRequest({ id, to })}
                >
                  {TRANSACTION_ACTION_LABELS[to]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
