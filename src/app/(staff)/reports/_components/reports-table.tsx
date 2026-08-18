"use client";
"use no memo";

import { useMemo, useState } from "react";

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
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Search,
  Tags,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

import type { ReportRow } from "./reports-types";

const kindLabels: Record<ReportRow["report_kind"], string> = {
  attendance: "Attendance",
  payroll: "Payroll",
  disbursement: "Disbursement",
  expense: "Expense",
  revenue: "Revenue",
  inventory: "Inventory",
  sales: "Sales",
  management: "Management",
  other: "Other",
};

const periodOptions = [
  { value: "all", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

export function ReportsTable({
  reports,
  canReview,
  onReview,
}: {
  reports: ReportRow[];
  canReview: boolean;
  onReview: (id: string) => void;
}) {
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "period_start", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const columns = useMemo<ColumnDef<ReportRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all reports on this page"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={`Select report ${row.original.id}`}
            />
          </div>
        ),
        enableHiding: false,
      },
      {
        id: "search",
        accessorFn: (row) => `${row.title} ${row.report_kind} ${row.status} ${row.description ?? ""}`,
        filterFn: "includesString",
        enableHiding: true,
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        accessorKey: "report_kind",
        header: "Kind",
        filterFn: "equalsString",
        cell: ({ row }) => <Badge variant="secondary">{kindLabels[row.original.report_kind]}</Badge>,
      },
      {
        accessorKey: "period_start",
        header: "Period",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.period_start ? new Date(row.original.period_start).toLocaleDateString() : "—"} —{" "}
            {row.original.period_end ? new Date(row.original.period_end).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        filterFn: "equalsString",
        cell: ({ row }) => (
          <Badge variant={row.original.status === "reviewed" ? "default" : "secondary"}>{row.original.status}</Badge>
        ),
      },
      {
        id: "periodWindow",
        accessorFn: (row) => {
          if (!row.period_start) return [];
          const days = Math.max(0, Math.round((Date.now() - new Date(row.period_start).getTime()) / 86_400_000));
          return days <= 30 ? ["30", "90"] : days <= 90 ? ["90"] : [];
        },
        filterFn: "arrIncludes",
        enableHiding: true,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const canMarkReviewed = canReview && row.original.status === "submitted";
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Open report actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={() => canMarkReviewed && onReview(row.original.id)}
                  disabled={!canMarkReviewed}
                >
                  <Check data-icon="inline-start" />
                  {canMarkReviewed ? "Mark Reviewed" : "No actions available"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [canReview, onReview],
  );
  const table = useReactTable({
    data: reports,
    columns,
    state: {
      rowSelection,
      columnFilters,
      sorting,
      pagination,
      columnVisibility: { search: false, periodWindow: false },
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
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const periodFilter = (table.getColumn("periodWindow")?.getFilterValue() as string) ?? "all";
  const kindFilter = (table.getColumn("report_kind")?.getFilterValue() as string) ?? "all";
  const setFilter = (id: string, value: string) => {
    table.getColumn(id)?.setFilterValue(value === "all" ? undefined : value);
    table.setPageIndex(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(event) => {
                table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                table.setPageIndex(0);
              }}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <UsersRound />
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40" align="start">
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={(value) => setFilter("status", value)}>
                {[
                  { value: "all", label: "All" },
                  { value: "draft", label: "Draft" },
                  { value: "submitted", label: "Submitted" },
                  { value: "reviewed", label: "Reviewed" },
                  { value: "archived", label: "Archived" },
                ].map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarDays />
                Period
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40" align="start">
              <DropdownMenuRadioGroup value={periodFilter} onValueChange={(value) => setFilter("periodWindow", value)}>
                {periodOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Tags />
                Kind
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44" align="start">
              <DropdownMenuRadioGroup value={kindFilter} onValueChange={(value) => setFilter("report_kind", value)}>
                <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                {Object.entries(kindLabels).map(([value, label]) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowUpDown />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={sorting[0]?.desc === false ? "oldest" : "newest"}
              onValueChange={(value) => {
                table.setSorting([{ id: "period_start", desc: value !== "oldest" }]);
                table.setPageIndex(0);
              }}
            >
              <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader className="bg-muted/15">
            <TableRow>
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className="h-11 p-3 font-medium">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                )),
              )}
            </TableRow>
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
            <Label htmlFor="reports-rows-per-page" className="font-medium text-sm">
              Rows per page
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" className="w-20" id="reports-rows-per-page">
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
  );
}
