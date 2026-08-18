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
  type Table as TableInstance,
  useReactTable,
  type VisibilityState,
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

export interface PayrollRunRow {
  id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "pending_approval" | "approved" | "finalized" | "cancelled";
  total_gross_cents: number;
  total_deductions_cents: number;
  total_net_cents: number;
  notes: string | null;
}

export interface CompensationRow {
  id: string;
  employee_id: string;
  base_salary_cents: number;
  effective_from: string;
  effective_until: string | null;
  profiles: { full_name: string | null } | null;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  pending_approval: "secondary",
  approved: "default",
  finalized: "default",
  cancelled: "destructive",
};

const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
] as const;
const dateOptions = [
  { value: "all", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

function checkboxColumn<T extends { id: string }>(label: string): ColumnDef<T> {
  return {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={`Select all ${label} on this page`}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={`Select ${label} ${row.original.id}`}
        />
      </div>
    ),
    enableHiding: false,
  };
}

function dateWindow(value: string) {
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days <= 30) return ["30", "90"];
  if (days <= 90) return ["90"];
  return [];
}

function TableFooter<TData>({ table, id }: { table: TableInstance<TData>; id: string }) {
  return (
    <div className="flex items-center justify-between px-1">
      <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
        {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor={id} className="font-medium text-sm">
            Rows per page
          </Label>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger size="sm" className="w-20" id={id}>
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
  );
}

function TableBodyView<TData>({ table }: { table: TableInstance<TData> }) {
  return (
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
  );
}

function CompensationStatus(row: CompensationRow) {
  const today = new Date().setHours(0, 0, 0, 0);
  const from = new Date(row.effective_from).setHours(0, 0, 0, 0);
  const until = row.effective_until ? new Date(row.effective_until).setHours(0, 0, 0, 0) : null;
  if (from > today) return "upcoming";
  if (until !== null && until < today) return "ended";
  return "active";
}

export function CompensationTable({ data }: { readonly data: CompensationRow[] }) {
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "effective_from", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [columnVisibility] = useState<VisibilityState>({
    search: false,
    effectiveWindow: false,
    effectiveStatus: false,
    term: false,
  });
  const columns = useMemo<ColumnDef<CompensationRow>[]>(
    () => [
      checkboxColumn<CompensationRow>("compensation"),
      {
        accessorKey: "employee_id",
        header: "Employee",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.profiles?.full_name ?? row.original.employee_id.slice(0, 8)}
          </span>
        ),
      },
      {
        id: "search",
        accessorFn: (row) => `${row.id} ${row.employee_id} ${row.profiles?.full_name ?? ""}`,
        filterFn: "includesString",
        enableHiding: true,
      },
      {
        accessorKey: "base_salary_cents",
        header: "Base Salary (₱/mo)",
        cell: ({ row }) => `₱${(row.original.base_salary_cents / 100).toLocaleString()}`,
      },
      {
        accessorKey: "effective_from",
        header: "Effective",
        cell: ({ row }) => new Date(row.original.effective_from).toLocaleDateString(),
      },
      {
        accessorKey: "effective_until",
        header: "Until",
        cell: ({ row }) =>
          row.original.effective_until ? new Date(row.original.effective_until).toLocaleDateString() : "—",
      },
      { id: "effectiveStatus", accessorFn: CompensationStatus, filterFn: "equalsString", enableHiding: true },
      {
        id: "effectiveWindow",
        accessorFn: (row) => dateWindow(row.effective_from),
        filterFn: "arrIncludes",
        enableHiding: true,
      },
      {
        id: "term",
        accessorFn: (row) => (row.effective_until ? "fixed" : "open"),
        filterFn: "equalsString",
        enableHiding: true,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        cell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Open compensation actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data,
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
  const statusFilter = (table.getColumn("effectiveStatus")?.getFilterValue() as string) ?? "all";
  const dateFilter = (table.getColumn("effectiveWindow")?.getFilterValue() as string) ?? "all";
  const termFilter = (table.getColumn("term")?.getFilterValue() as string) ?? "all";
  const sortValue =
    sorting[0]?.id === "employee_id"
      ? sorting[0].desc
        ? "name-desc"
        : "name-asc"
      : sorting[0]?.desc === false
        ? "oldest"
        : "newest";
  return (
    <div className="space-y-4">
      <PayrollToolbar
        searchPlaceholder="Search compensation..."
        searchQuery={searchQuery}
        onSearch={(value) => {
          table.getColumn("search")?.setFilterValue(value || undefined);
          table.setPageIndex(0);
        }}
        filters={[
          {
            label: "Status",
            icon: UsersRound,
            value: statusFilter,
            options: [
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "upcoming", label: "Upcoming" },
              { value: "ended", label: "Ended" },
            ],
            onChange: (value) => {
              table.getColumn("effectiveStatus")?.setFilterValue(value === "all" ? undefined : value);
              table.setPageIndex(0);
            },
          },
          {
            label: "Effective date",
            icon: CalendarDays,
            value: dateFilter,
            options: dateOptions,
            onChange: (value) => {
              table.getColumn("effectiveWindow")?.setFilterValue(value === "all" ? undefined : value);
              table.setPageIndex(0);
            },
          },
          {
            label: "Term",
            icon: UsersRound,
            value: termFilter,
            options: [
              { value: "all", label: "All" },
              { value: "open", label: "Open-ended" },
              { value: "fixed", label: "Fixed-term" },
            ],
            onChange: (value) => {
              table.getColumn("term")?.setFilterValue(value === "all" ? undefined : value);
              table.setPageIndex(0);
            },
          },
        ]}
        sortValue={sortValue}
        onSort={(value) => {
          table.setSorting(
            value === "oldest"
              ? [{ id: "effective_from", desc: false }]
              : value === "name-asc"
                ? [{ id: "employee_id", desc: false }]
                : value === "name-desc"
                  ? [{ id: "employee_id", desc: true }]
                  : [{ id: "effective_from", desc: true }],
          );
          table.setPageIndex(0);
        }}
      />
      <TableBodyView table={table} />
      <TableFooter table={table} id="payroll-compensation-rows-per-page" />
    </div>
  );
}

export function PayrollRunsTable({
  data,
  canReview,
  canFinalize,
  onReview,
  onFinalize,
}: {
  readonly data: PayrollRunRow[];
  readonly canReview: boolean;
  readonly canFinalize: boolean;
  readonly onReview: (id: string, decision: "approved" | "rejected") => void;
  readonly onFinalize: (id: string) => void;
}) {
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "period", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [columnVisibility] = useState<VisibilityState>({ search: false, periodWindow: false, deductionsFilter: false });
  const columns = useMemo<ColumnDef<PayrollRunRow>[]>(
    () => [
      checkboxColumn<PayrollRunRow>("payroll runs"),
      {
        id: "search",
        accessorFn: (row) => `${row.id} ${row.status} ${row.period_start} ${row.period_end} ${row.notes ?? ""}`,
        filterFn: "includesString",
        enableHiding: true,
      },
      {
        id: "period",
        header: "Period",
        accessorFn: (row) => row.period_start,
        cell: ({ row }) =>
          `${new Date(row.original.period_start).toLocaleDateString()} — ${new Date(row.original.period_end).toLocaleDateString()}`,
      },
      {
        accessorKey: "total_gross_cents",
        header: "Gross",
        cell: ({ row }) => `₱${(row.original.total_gross_cents / 100).toLocaleString()}`,
      },
      {
        accessorKey: "total_deductions_cents",
        header: "Deductions",
        cell: ({ row }) => `₱${(row.original.total_deductions_cents / 100).toLocaleString()}`,
      },
      {
        accessorKey: "total_net_cents",
        header: "Net",
        cell: ({ row }) => (
          <span className="font-medium">₱{(row.original.total_net_cents / 100).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        filterFn: "equalsString",
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANTS[row.original.status]}>{row.original.status.replace(/_/g, " ")}</Badge>
        ),
      },
      {
        id: "periodWindow",
        accessorFn: (row) => dateWindow(row.period_start),
        filterFn: "arrIncludes",
        enableHiding: true,
      },
      {
        id: "deductionsFilter",
        accessorFn: (row) => (row.total_deductions_cents > 0 ? "with" : "without"),
        filterFn: "equalsString",
        enableHiding: true,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const run = row.original;
          const canDecide = canReview && (run.status === "draft" || run.status === "pending_approval");
          const canClose = canFinalize && run.status === "approved";
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Open payroll run actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canDecide ? (
                  <>
                    <DropdownMenuItem onClick={() => onReview(run.id, "approved")}>
                      <Check data-icon="inline-start" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => onReview(run.id, "rejected")}>
                      Reject
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canClose ? (
                  <DropdownMenuItem onClick={() => onFinalize(run.id)}>
                    <Check data-icon="inline-start" />
                    Finalize
                  </DropdownMenuItem>
                ) : null}
                {!canDecide && !canClose ? <DropdownMenuItem disabled>No actions available</DropdownMenuItem> : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [canFinalize, canReview, onFinalize, onReview],
  );
  const table = useReactTable({
    data,
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
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const periodFilter = (table.getColumn("periodWindow")?.getFilterValue() as string) ?? "all";
  const deductionsFilter = (table.getColumn("deductionsFilter")?.getFilterValue() as string) ?? "all";
  const sortValue = sorting[0]?.desc === false ? "oldest" : "newest";
  return (
    <div className="space-y-4">
      <PayrollToolbar
        searchPlaceholder="Search payroll runs..."
        searchQuery={searchQuery}
        onSearch={(value) => {
          table.getColumn("search")?.setFilterValue(value || undefined);
          table.setPageIndex(0);
        }}
        filters={[
          {
            label: "Status",
            icon: UsersRound,
            value: statusFilter,
            options: [
              { value: "all", label: "All" },
              { value: "draft", label: "Draft" },
              { value: "pending_approval", label: "Pending approval" },
              { value: "approved", label: "Approved" },
              { value: "finalized", label: "Finalized" },
              { value: "cancelled", label: "Cancelled" },
            ],
            onChange: (value) => {
              table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
              table.setPageIndex(0);
            },
          },
          {
            label: "Period",
            icon: CalendarDays,
            value: periodFilter,
            options: dateOptions,
            onChange: (value) => {
              table.getColumn("periodWindow")?.setFilterValue(value === "all" ? undefined : value);
              table.setPageIndex(0);
            },
          },
          {
            label: "Deductions",
            icon: UsersRound,
            value: deductionsFilter,
            options: [
              { value: "all", label: "All" },
              { value: "with", label: "With deductions" },
              { value: "without", label: "No deductions" },
            ],
            onChange: (value) => {
              table.getColumn("deductionsFilter")?.setFilterValue(value === "all" ? undefined : value);
              table.setPageIndex(0);
            },
          },
        ]}
        sortValue={sortValue}
        onSort={(value) => {
          table.setSorting(value === "oldest" ? [{ id: "period", desc: false }] : [{ id: "period", desc: true }]);
          table.setPageIndex(0);
        }}
      />
      <TableBodyView table={table} />
      <TableFooter table={table} id="payroll-runs-rows-per-page" />
    </div>
  );
}

interface PayrollToolbarProps {
  searchPlaceholder: string;
  searchQuery: string;
  onSearch: (value: string) => void;
  filters: Array<{
    label: string;
    icon: typeof UsersRound;
    value: string;
    options: readonly { value: string; label: string }[];
    onChange: (value: string) => void;
  }>;
  sortValue: string;
  onSort: (value: string) => void;
}

function PayrollToolbar({ searchPlaceholder, searchQuery, onSearch, filters, sortValue, onSort }: PayrollToolbarProps) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
        {filters.slice(0, 2).map((filter) => {
          const Icon = filter.icon;
          return (
            <DropdownMenu key={filter.label}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Icon />
                  {filter.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40" align="start">
                <DropdownMenuRadioGroup value={filter.value} onValueChange={filter.onChange}>
                  {filter.options.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
        {filters.slice(2).map((filter) => {
          const Icon = filter.icon;
          return (
            <DropdownMenu key={filter.label}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Icon />
                  {filter.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={filter.value} onValueChange={filter.onChange}>
                  {filter.options.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowUpDown />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={sortValue} onValueChange={onSort}>
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
  );
}
