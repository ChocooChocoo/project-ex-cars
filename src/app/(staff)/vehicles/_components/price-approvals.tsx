"use client";
"use no memo";

import * as React from "react";

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
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  MoreHorizontal,
  Search,
  Stamp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { approvePrice } from "@/app/(staff)/vehicles/actions";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface PriceProposalRow {
  id: string;
  vehicle_id: string;
  proposed_amount: number;
  notes: string | null;
  created_at: string;
  vehicles: { make: string | null; model: string | null; year: number | null } | null;
}

type Decision = "approved" | "rejected";

const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount-desc", label: "Amount high to low" },
  { value: "amount-asc", label: "Amount low to high" },
] as const;

export function PendingApprovalsTable({ proposals }: { readonly proposals: PriceProposalRow[] }) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility] = React.useState<VisibilityState>({
    search: false,
    created_at: false,
  });
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [decisionTarget, setDecisionTarget] = React.useState<{ proposal: PriceProposalRow; decision: Decision } | null>(
    null,
  );
  const [submitting, setSubmitting] = React.useState(false);

  async function handleDecision() {
    if (!decisionTarget) return;
    const { proposal, decision } = decisionTarget;
    setSubmitting(true);
    const fd = new FormData();
    fd.set("proposal_id", proposal.id);
    fd.set("decision", decision);
    fd.set("vehicle_id", proposal.vehicle_id);
    const result = await approvePrice(fd);
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(decision === "approved" ? "Price proposal approved." : "Price proposal rejected.");
    setDecisionTarget(null);
    router.refresh();
  }

  const columns: ColumnDef<PriceProposalRow>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all proposals on this page"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select proposal ${row.original.id.slice(0, 8)}`}
          />
        </div>
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "search",
      accessorFn: (row) => {
        const vehicle = row.vehicles;
        return `${vehicle?.make ?? ""} ${vehicle?.model ?? ""} ${vehicle?.year ?? ""} ${row.vehicle_id} ${row.id}`;
      },
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      id: "created_at",
      accessorFn: (row) => row.created_at,
      enableHiding: true,
    },
    {
      id: "vehicle",
      header: "Vehicle",
      cell: ({ row }) => {
        const vehicle = row.original.vehicles;
        return (
          <div className="grid gap-0.5">
            <span className="font-medium text-sm">
              {vehicle ? `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() : row.original.vehicle_id.slice(0, 8)}
            </span>
            <span className="text-muted-foreground text-xs">{vehicle?.year ?? "—"}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "proposed_amount",
      header: "Proposed Price",
      cell: ({ row }) => <span className="font-medium text-sm">₱{row.original.proposed_amount.toLocaleString()}</span>,
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.notes ?? "—"}</span>,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const proposal = row.original;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={`Open actions for ${proposal.vehicle_id.slice(0, 8)}`}
                  className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                  size="icon-sm"
                  variant="ghost"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/vehicles/${proposal.vehicle_id}`}>
                    <Eye className="mr-2 size-4" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDecisionTarget({ proposal, decision: "approved" })}>
                  <Check className="mr-2 size-4" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDecisionTarget({ proposal, decision: "rejected" })}
                >
                  <X className="mr-2 size-4" />
                  Reject
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data: proposals,
    columns,
    state: {
      rowSelection,
      columnFilters,
      sorting,
      columnVisibility,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string) ?? "";
  const sortValue = React.useMemo(() => {
    const currentSort = sorting[0];

    if (!currentSort) return "newest";
    if (currentSort.id === "created_at" && currentSort.desc) return "newest";
    if (currentSort.id === "created_at" && !currentSort.desc) return "oldest";
    if (currentSort.id === "proposed_amount" && currentSort.desc) return "amount-desc";
    if (currentSort.id === "proposed_amount" && !currentSort.desc) return "amount-asc";

    return "newest";
  }, [sorting]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none">
            <span className="flex items-center gap-2">
              <Stamp className="size-4 text-muted-foreground" />
              Pending Price Approvals
            </span>
          </CardTitle>
          <CardDescription>Price proposals awaiting your decision.</CardDescription>
          <CardAction>
            <Badge variant="secondary" className="rounded-md">
              {proposals.length} pending
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                    placeholder="Search proposals..."
                    value={searchQuery}
                    onChange={(event) => {
                      table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                      table.setPageIndex(0);
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ArrowUpDown />
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                      value={sortValue}
                      onValueChange={(value) => {
                        const nextSorting: SortingState =
                          value === "oldest"
                            ? [{ id: "created_at", desc: false }]
                            : value === "amount-desc"
                              ? [{ id: "proposed_amount", desc: true }]
                              : value === "amount-asc"
                                ? [{ id: "proposed_amount", desc: false }]
                                : [{ id: "created_at", desc: true }];

                        table.setSorting(nextSorting);
                        table.setPageIndex(0);
                      }}
                    >
                      {sortOptions.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader className="bg-muted/15">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} colSpan={header.colSpan} className="h-11 p-3 font-medium">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="p-3 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
                {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
                selected.
              </div>
              <div className="flex w-full items-center gap-8 lg:w-fit">
                <div className="hidden items-center gap-2 lg:flex">
                  <Label htmlFor="pending-approvals-rows-per-page" className="font-medium text-sm">
                    Rows per page
                  </Label>
                  <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => {
                      table.setPageSize(Number(value));
                    }}
                  >
                    <SelectTrigger size="sm" className="w-20" id="pending-approvals-rows-per-page">
                      <SelectValue placeholder={table.getState().pagination.pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      <SelectGroup>
                        {[10, 20, 30, 40, 50].map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>
                            {pageSize}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-fit items-center justify-center font-medium text-sm">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </div>
                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                  <Button
                    variant="outline"
                    className="hidden size-8 lg:flex"
                    size="icon"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Go to first page</span>
                    <ChevronsLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="size-8"
                    size="icon"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="size-8"
                    size="icon"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="hidden size-8 lg:flex"
                    size="icon"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Go to last page</span>
                    <ChevronsRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={decisionTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDecisionTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decisionTarget?.decision === "approved" ? "Approve price proposal?" : "Reject price proposal?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decisionTarget
                ? decisionTarget.decision === "approved"
                  ? `Approving sets the vehicle price to ₱${decisionTarget.proposal.proposed_amount.toLocaleString()} and makes it available for purchase.`
                  : "Rejecting moves the vehicle back to draft and leaves the current price unchanged."
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={decisionTarget?.decision === "rejected" ? "destructive" : "default"}
              onClick={handleDecision}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : decisionTarget?.decision === "approved" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
