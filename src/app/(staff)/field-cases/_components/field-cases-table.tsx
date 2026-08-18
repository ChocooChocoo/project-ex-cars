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
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Search,
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
import { FIELD_CASE_STATES, type FieldCaseState } from "@/lib/validation/phase6";

import type { FieldCaseRow } from "./field-cases-client";

const STATE_VARIANTS: Record<FieldCaseState, "default" | "secondary" | "outline" | "destructive"> = {
  assigned: "secondary",
  accepted: "default",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};
const dateOptions = [
  { value: "all", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;
const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Kind A-Z" },
  { value: "name-desc", label: "Kind Z-A" },
] as const;
const kindOptions = [
  { value: "all", label: "All" },
  { value: "acquisition", label: "Acquisition" },
  { value: "delivery", label: "Delivery" },
  { value: "recovery", label: "Recovery" },
  { value: "sourcing", label: "Sourcing" },
] as const;

export function FieldCasesTable({
  cases,
  canUpdate,
  canAssignMechanic,
  onUpdate,
  onAssignMechanic,
}: {
  readonly cases: FieldCaseRow[];
  readonly canUpdate: boolean;
  readonly canAssignMechanic: boolean;
  readonly onUpdate: (fieldCase: FieldCaseRow) => void;
  readonly onAssignMechanic: (fieldCase: FieldCaseRow) => void;
}) {
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [columnVisibility] = useState<VisibilityState>({ search: false, createdWindow: false });
  const columns = useMemo<ColumnDef<FieldCaseRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all field cases on this page"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={`Select field case ${row.original.id}`}
            />
          </div>
        ),
        enableHiding: false,
      },
      {
        id: "search",
        accessorFn: (row) =>
          `${row.id} ${row.case_kind} ${row.state} ${row.vehicle_id ?? ""} ${row.location ?? ""} ${row.notes ?? ""}`,
        filterFn: "includesString",
        enableHiding: true,
      },
      {
        accessorKey: "case_kind",
        header: "Kind",
        filterFn: "equalsString",
        cell: ({ row }) => <span className="font-medium capitalize">{row.original.case_kind}</span>,
      },
      {
        accessorKey: "state",
        header: "State",
        filterFn: "equalsString",
        cell: ({ row }) => (
          <Badge variant={STATE_VARIANTS[row.original.state]} className="capitalize">
            {row.original.state.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "vehicle_id",
        header: "Vehicle",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.vehicle_id ? row.original.vehicle_id.slice(0, 8) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.location ?? "—"}</span>,
      },
      {
        accessorKey: "expenses_cents",
        header: "Expenses",
        cell: ({ row }) => `₱${((row.original.expenses_cents ?? 0) / 100).toLocaleString()}`,
      },
      {
        accessorKey: "completion_date",
        header: "Completed",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.completion_date ? new Date(row.original.completion_date).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        id: "createdWindow",
        accessorFn: (row) => {
          const days = Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 86_400_000));
          return days <= 30 ? ["30", "90"] : days <= 90 ? ["90"] : [];
        },
        filterFn: "arrIncludes",
        enableHiding: true,
      },
      { accessorKey: "created_at", enableHiding: true },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Open field case actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canUpdate && canAssignMechanic ? (
                <DropdownMenuItem onClick={() => onAssignMechanic(row.original)}>
                  <UsersRound data-icon="inline-start" />
                  Assign Mechanic
                </DropdownMenuItem>
              ) : null}
              {canUpdate ? (
                <DropdownMenuItem onClick={() => onUpdate(row.original)}>
                  <MoreHorizontal data-icon="inline-start" />
                  Update
                </DropdownMenuItem>
              ) : null}
              {!canUpdate ? <DropdownMenuItem disabled>No actions available</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [canAssignMechanic, canUpdate, onAssignMechanic, onUpdate],
  );
  const table = useReactTable({
    data: cases,
    columns,
    state: { rowSelection, columnFilters, sorting, columnVisibility, pagination },
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
  const stateFilter = (table.getColumn("state")?.getFilterValue() as string) ?? "all";
  const dateFilter = (table.getColumn("createdWindow")?.getFilterValue() as string) ?? "all";
  const kindFilter = (table.getColumn("case_kind")?.getFilterValue() as string) ?? "all";
  const sortValue =
    sorting[0]?.id === "case_kind"
      ? sorting[0].desc
        ? "name-desc"
        : "name-asc"
      : sorting[0]?.desc === false
        ? "oldest"
        : "newest";
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
              placeholder="Search field cases..."
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
                State
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40" align="start">
              <DropdownMenuRadioGroup value={stateFilter} onValueChange={(value) => setFilter("state", value)}>
                {[
                  { value: "all", label: "All" },
                  ...FIELD_CASE_STATES.map((state) => ({ value: state, label: state.replace(/_/g, " ") })),
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
                Created date
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40" align="start">
              <DropdownMenuRadioGroup value={dateFilter} onValueChange={(value) => setFilter("createdWindow", value)}>
                {dateOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <UsersRound />
                Kind
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={kindFilter} onValueChange={(value) => setFilter("case_kind", value)}>
                {kindOptions.map((option) => (
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
                <ArrowUpDown />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={sortValue}
                onValueChange={(value) => {
                  table.setSorting(
                    value === "oldest"
                      ? [{ id: "created_at", desc: false }]
                      : value === "name-asc"
                        ? [{ id: "case_kind", desc: false }]
                        : value === "name-desc"
                          ? [{ id: "case_kind", desc: true }]
                          : [{ id: "created_at", desc: true }],
                  );
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
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
            <Label htmlFor="field-cases-rows-per-page" className="font-medium text-sm">
              Rows per page
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" className="w-20" id="field-cases-rows-per-page">
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
