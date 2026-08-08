"use client";
"use no memo";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Eye, MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";

import { transitionTransaction } from "@/app/(ceo)/transactions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Pagination, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TRANSACTION_STATE_LABELS,
  transactionKindLabel,
  transactionStatusBadgeVariant,
} from "@/lib/transactions/labels";
import { getAllowedTransitions, type TransactionState } from "@/lib/transactions/state-machine";

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
  const [kindFilter, setKindFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = transactions.filter((t) => {
    if (kindFilter !== "all" && t.transaction_kind !== kindFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const vehicles = t.vehicles as Record<string, unknown> | undefined;
      const label = [vehicles?.make, vehicles?.model].filter(Boolean).join(" ").toLowerCase();
      if (!label.includes(q)) return false;
    }
    return true;
  });

  const columns: ColumnDef<Record<string, unknown>>[] = [
    {
      accessorKey: "transaction_kind",
      header: "Kind",
      cell: ({ row }) => {
        const kind = row.original.transaction_kind as string;
        return <Badge variant="outline">{transactionKindLabel(kind as never)}</Badge>;
      },
    },
    {
      accessorKey: "vehicle",
      header: "Vehicle",
      cell: ({ row }) => {
        const v = row.original.vehicles as Record<string, unknown> | undefined;
        return v ? `${v.make} ${v.model} (${v.year})` : "—";
      },
    },
    {
      accessorKey: "current_state",
      header: "State",
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
        return new Date(d).toLocaleDateString();
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const t = row.original;
        const id = t.id as string;
        const state = (t.current_state ?? "pending") as TransactionState;
        const allowed = getAllowedTransitions(state, userRole);

        async function doTransition(to: TransactionState) {
          const fd = new FormData();
          fd.set("id", id);
          fd.set("to_state", to);
          const result = await transitionTransaction(fd);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success(`Transaction marked ${to.replace(/_/g, " ")}.`);
            router.refresh();
          }
        }

        return (
          <div className="flex items-center gap-1">
            {allowed.map((to) => (
              <Button key={to} variant="outline" size="sm" onClick={() => doTransition(to)}>
                {to.replace(/_/g, " ")}
              </Button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/transactions/${id}`}>
                    <Eye className="mr-2 size-4" />
                    View Details
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <InputGroup>
            <InputGroupAddon>
              <Search className="size-4" />
            </InputGroupAddon>
            <input
              className="h-9 w-48 bg-transparent text-sm outline-none"
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <InputGroupAddon>
              <Kbd>⌘K</Kbd>
            </InputGroupAddon>
          </InputGroup>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
                <SelectItem value="request_a_car">Request</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b">
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                    {r.getVisibleCells().map((c) => (
                      <td key={c.id} className="px-4 py-3">
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              filtered.length,
            )}{" "}
            of {filtered.length}
          </p>
          <Pagination>
            <PaginationPrevious onClick={() => table.previousPage()} aria-disabled={!table.getCanPreviousPage()} />
            {Array.from({ length: Math.min(5, table.getPageCount()) }).map((_, i) => (
              <PaginationLink
                key={`page-${i}`}
                isActive={table.getState().pagination.pageIndex === i}
                onClick={() => table.setPageIndex(i)}
              >
                {i + 1}
              </PaginationLink>
            ))}
            <PaginationNext onClick={() => table.nextPage()} aria-disabled={!table.getCanNextPage()} />
          </Pagination>
        </div>
      </CardContent>
    </Card>
  );
}
