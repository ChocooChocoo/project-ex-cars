"use client";
"use no memo";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { Eye, MoreHorizontal, ReceiptText, Search } from "lucide-react";
import { toast } from "sonner";

import { transitionTransaction } from "@/app/(staff)/transactions/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TRANSACTION_STATE_LABELS,
  transactionKindLabel,
  transactionStatusBadgeVariant,
} from "@/lib/transactions/labels";
import { getAllowedTransitions, type TransactionState } from "@/lib/transactions/state-machine";

const KIND_FILTER_OPTIONS = ["All", "buy", "sell", "request_a_car"];
const STATUS_FILTER_OPTIONS: ("All" | TransactionState)[] = [
  "All",
  "pending",
  "under_review",
  "approved",
  "rejected",
  "completed",
  "cancelled",
];
const TRANSACTION_ACTION_LABELS: Record<TransactionState, string> = {
  pending: "Pending",
  under_review: "Under Review",
  approved: "Approve",
  rejected: "Reject",
  completed: "Complete",
  cancelled: "Cancel",
};

export function TransactionsTable({
  transactions,
  userRole,
}: {
  readonly transactions: Record<string, unknown>[];
  readonly userRole: string;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ search: false });
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [transitionTarget, setTransitionTarget] = useState<{ id: string; to: TransactionState } | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  async function handleTransition() {
    if (!transitionTarget) return;
    setTransitioning(true);
    const fd = new FormData();
    fd.set("id", transitionTarget.id);
    fd.set("to_state", transitionTarget.to);
    const result = await transitionTransaction(fd);
    setTransitioning(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Transaction marked ${transitionTarget.to.replace(/_/g, " ")}.`);
    setTransitionTarget(null);
    router.refresh();
  }

  const columns: ColumnDef<Record<string, unknown>>[] = [
    {
      id: "search",
      accessorFn: (row) => {
        const v = row.vehicles as Record<string, unknown> | undefined;
        return `${v?.make ?? ""} ${v?.model ?? ""} ${v?.year ?? ""}`;
      },
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      accessorKey: "transaction_kind",
      header: "Kind",
      filterFn: "equalsString",
      cell: ({ row }) => {
        const kind = row.original.transaction_kind as string;
        return <Badge variant="outline">{transactionKindLabel(kind as never)}</Badge>;
      },
    },
    {
      id: "vehicle",
      header: "Vehicle",
      cell: ({ row }) => {
        const v = row.original.vehicles as Record<string, unknown> | undefined;
        return v ? (
          <div className="grid gap-0.5">
            <span className="font-medium">
              {v.make as string} {v.model as string}
            </span>
            <span className="text-muted-foreground text-xs">{v.year as string}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: "current_state",
      header: "State",
      filterFn: "equalsString",
      cell: ({ row }) => {
        const state = (row.original.current_state ?? "pending") as TransactionState;
        return <Badge variant={transactionStatusBadgeVariant(state)}>{TRANSACTION_STATE_LABELS[state]}</Badge>;
      },
    },
    {
      accessorKey: "opened_at",
      header: "Opened",
      cell: ({ row }) => {
        const d = row.original.opened_at as string;
        return <span className="text-muted-foreground text-sm">{new Date(d).toLocaleDateString()}</span>;
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const t = row.original;
        const id = t.id as string;
        const state = (t.current_state ?? "pending") as TransactionState;
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
                  onClick={() => setTransitionTarget({ id, to })}
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

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting, columnFilters, columnVisibility, pagination },
    getRowId: (row) => row.id as string,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string) ?? "";
  const kindFilter = (table.getColumn("transaction_kind")?.getFilterValue() as string) ?? "All";
  const statusFilter = (table.getColumn("current_state")?.getFilterValue() as string) ?? "All";
  function setColumnSelectFilter(columnId: string, value: string) {
    table.getColumn(columnId)?.setFilterValue(value === "All" ? undefined : value);
    table.setPageIndex(0);
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">Transactions</CardTitle>
          <CardDescription className="max-w-sm leading-snug">
            Manage buy, sell, and request-a-car transactions.
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <InputGroup className="h-7 w-full md:w-64">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                className="h-7"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(event) => {
                  table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                  table.setPageIndex(0);
                }}
              />
              <InputGroupAddon align="inline-end">
                <Kbd className="h-4 text-[10px]">⌘K</Kbd>
              </InputGroupAddon>
            </InputGroup>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={kindFilter} onValueChange={(value) => setColumnSelectFilter("transaction_kind", value)}>
                <SelectTrigger size="sm">
                  <span className="text-muted-foreground">Kind:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectGroup>
                    {KIND_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === "request_a_car" ? "Request" : option === "All" ? "All" : option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => setColumnSelectFilter("current_state", value)}>
                <SelectTrigger size="sm">
                  <span className="text-muted-foreground">Status:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectGroup>
                    {STATUS_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === "All" ? "All" : TRANSACTION_STATE_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <ReceiptText className="size-4" />
              {table.getFilteredRowModel().rows.length} transactions
            </div>
          </div>

          <DataTable table={table} rowsPerPageId="staff-transactions-rows-per-page" />
        </CardContent>
      </Card>

      <AlertDialog
        open={transitionTarget !== null}
        onOpenChange={(open) => {
          if (!open) setTransitionTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="capitalize">
              {transitionTarget ? TRANSACTION_ACTION_LABELS[transitionTarget.to] : ""} transaction?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {transitionTarget ? (
                <>
                  This will mark the transaction as{" "}
                  <span className="font-medium text-foreground capitalize">
                    {TRANSACTION_STATE_LABELS[transitionTarget.to]}
                  </span>
                  . This action cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={
                transitionTarget?.to === "cancelled" || transitionTarget?.to === "rejected" ? "destructive" : "default"
              }
              onClick={handleTransition}
              disabled={transitioning}
            >
              {transitioning ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
