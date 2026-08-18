"use client";
"use no memo";

import { useCallback, useMemo, useState } from "react";

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
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Grid2X2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Table2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { completeDutyCheck, startDutyCheck, uploadDutyEvidence } from "@/app/(staff)/security-duty-checks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { DutyEvidenceControl, type DutyEvidenceSlot, type DutyEvidenceUpload } from "./duty-evidence-control";

export interface DutyCheckRow {
  id: string;
  duty_date: string;
  before_image_path: string | null;
  after_image_path: string | null;
  notes: string | null;
  status: "pending" | "in_progress" | "completed";
  completed_at: string | null;
}

export type DutyCheckView = "table" | "list" | "grid";

interface SecurityDutyChecksClientProps {
  checks: DutyCheckRow[];
  canManage: boolean;
}

interface DutyCheckEvidenceProps {
  check: DutyCheckRow;
  canManage: boolean;
  uploadingId: string | null;
  onUpload: DutyEvidenceUpload;
}

function formatDutyDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function isDutyCheckView(value: string): value is DutyCheckView {
  return value === "table" || value === "list" || value === "grid";
}

function statusVariant(status: DutyCheckRow["status"]): "default" | "secondary" | "outline" {
  if (status === "completed") return "default";
  if (status === "in_progress") return "secondary";
  return "outline";
}

function renderStatus(status: DutyCheckRow["status"]) {
  return <Badge variant={statusVariant(status)}>{status.replace(/_/g, " ")}</Badge>;
}

function DutyCheckEvidence({ check, canManage, uploadingId, onUpload }: DutyCheckEvidenceProps) {
  const disabled = check.status === "completed";
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      {(["before", "after"] as const).map((slot: DutyEvidenceSlot) => (
        <DutyEvidenceControl
          key={slot}
          checkId={check.id}
          dutyDate={check.duty_date}
          slot={slot}
          path={slot === "before" ? check.before_image_path : check.after_image_path}
          canManage={canManage}
          disabled={disabled}
          uploading={uploadingId === `${check.id}-${slot}`}
          onUpload={onUpload}
        />
      ))}
    </div>
  );
}

interface DutyCheckActionProps {
  check: DutyCheckRow;
  canManage: boolean;
  onComplete: (id: string) => Promise<void>;
}

function DutyCheckAction({ check, canManage, onComplete }: DutyCheckActionProps) {
  if (!canManage || check.status === "completed") return null;
  const canComplete = Boolean(check.before_image_path && check.after_image_path);
  return (
    <Button size="sm" disabled={!canComplete} onClick={() => void onComplete(check.id)}>
      <CheckCircle2 data-icon="inline-start" />
      Complete Check
    </Button>
  );
}

interface DutyCheckTableProps {
  checks: DutyCheckRow[];
  canManage: boolean;
  uploadingId: string | null;
  onUpload: DutyEvidenceUpload;
  onComplete: (id: string) => Promise<void>;
}

function DutyCheckTable({ checks, canManage, uploadingId, onUpload, onComplete }: DutyCheckTableProps) {
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "duty_date", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [columnVisibility] = useState<VisibilityState>({ search: false, dutyWindow: false, evidenceFilter: false });
  const columns = useMemo<ColumnDef<DutyCheckRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all duty checks on this page"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={`Select duty check ${row.original.id}`}
            />
          </div>
        ),
        enableHiding: false,
      },
      {
        id: "search",
        accessorFn: (row) => `${row.id} ${row.duty_date} ${row.status} ${row.notes ?? ""}`,
        filterFn: "includesString",
        enableHiding: true,
      },
      {
        id: "dutyWindow",
        accessorFn: (row) => {
          const days = Math.max(0, Math.round((Date.now() - new Date(row.duty_date).getTime()) / 86_400_000));
          return days <= 30 ? ["30", "90"] : days <= 90 ? ["90"] : [];
        },
        filterFn: "arrIncludes",
        enableHiding: true,
      },
      {
        id: "evidenceFilter",
        accessorFn: (row) => {
          const before = Boolean(row.before_image_path);
          const after = Boolean(row.after_image_path);
          return before && after
            ? "complete"
            : !before && !after
              ? "missing_both"
              : before
                ? "missing_after"
                : "missing_before";
        },
        filterFn: "equalsString",
        enableHiding: true,
      },
      {
        accessorKey: "duty_date",
        header: "Date",
        cell: ({ row }) => <span data-testid="duty-check-date">{formatDutyDate(row.original.duty_date)}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => renderStatus(row.original.status),
      },
      {
        id: "before",
        header: "Before",
        cell: ({ row }) => (
          <DutyEvidenceControl
            checkId={row.original.id}
            dutyDate={row.original.duty_date}
            slot="before"
            path={row.original.before_image_path}
            canManage={canManage}
            disabled={row.original.status === "completed"}
            uploading={uploadingId === `${row.original.id}-before`}
            onUpload={onUpload}
          />
        ),
      },
      {
        id: "after",
        header: "After",
        cell: ({ row }) => (
          <DutyEvidenceControl
            checkId={row.original.id}
            dutyDate={row.original.duty_date}
            slot="after"
            path={row.original.after_image_path}
            canManage={canManage}
            disabled={row.original.status === "completed"}
            uploading={uploadingId === `${row.original.id}-after`}
            onUpload={onUpload}
          />
        ),
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.notes ?? "—"}</span>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const check = row.original;
          const canComplete = Boolean(check.before_image_path && check.after_image_path);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Open duty check actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canManage && check.status !== "completed" ? (
                  <DropdownMenuItem disabled={!canComplete} onClick={() => void onComplete(check.id)}>
                    <CheckCircle2 data-icon="inline-start" />
                    Complete Check
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [canManage, onComplete, onUpload, uploadingId],
  );

  const table = useReactTable({
    data: checks,
    columns,
    state: { rowSelection, columnFilters, sorting, columnVisibility, pagination },
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
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
  const dutyDateFilter = (table.getColumn("dutyWindow")?.getFilterValue() as string) ?? "all";
  const evidenceFilter = (table.getColumn("evidenceFilter")?.getFilterValue() as string) ?? "all";
  const sortValue = sorting[0]?.desc === false ? "oldest" : "newest";
  const dateOptions = [
    { value: "all", label: "All time" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
  ] as const;
  const setFilter = (id: string, value: string) => {
    table.getColumn(id)?.setFilterValue(value === "all" ? undefined : value);
    table.setPageIndex(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{checks.length} duty checks</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 pt-0">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                  placeholder="Search duty checks..."
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
                      { value: "pending", label: "Pending" },
                      { value: "in_progress", label: "In progress" },
                      { value: "completed", label: "Completed" },
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
                    Duty date
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="start">
                  <DropdownMenuRadioGroup
                    value={dutyDateFilter}
                    onValueChange={(value) => setFilter("dutyWindow", value)}
                  >
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
                    Evidence
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={evidenceFilter}
                    onValueChange={(value) => setFilter("evidenceFilter", value)}
                  >
                    {[
                      { value: "all", label: "All" },
                      { value: "complete", label: "Complete" },
                      { value: "missing_before", label: "Missing before" },
                      { value: "missing_after", label: "Missing after" },
                      { value: "missing_both", label: "Missing both" },
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
                    <ArrowUpDown />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={sortValue}
                    onValueChange={(value) => {
                      table.setSorting(
                        value === "oldest" ? [{ id: "duty_date", desc: false }] : [{ id: "duty_date", desc: true }],
                      );
                      table.setPageIndex(0);
                    }}
                  >
                    <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="min-w-0 overflow-x-auto">
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
          </div>
          <div className="flex items-center justify-between px-1">
            <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
              {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
              selected.
            </div>
            <div className="flex w-full items-center gap-8 lg:w-fit">
              <div className="hidden items-center gap-2 lg:flex">
                <Label htmlFor="security-duty-checks-rows-per-page" className="font-medium text-sm">
                  Rows per page
                </Label>
                <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => table.setPageSize(Number(value))}
                >
                  <SelectTrigger size="sm" className="w-20" id="security-duty-checks-rows-per-page">
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
  );
}

interface DutyCheckListProps {
  checks: DutyCheckRow[];
  canManage: boolean;
  uploadingId: string | null;
  onUpload: DutyEvidenceUpload;
  onComplete: (id: string) => Promise<void>;
}

function DutyCheckList({ checks, canManage, uploadingId, onUpload, onComplete }: DutyCheckListProps) {
  return (
    <ItemGroup>
      {checks.map((check) => (
        <Item key={check.id} role="listitem" variant="outline" data-testid="duty-check-item" className="items-start">
          <ItemContent>
            <ItemHeader>
              <ItemTitle data-testid="duty-check-date">{formatDutyDate(check.duty_date)}</ItemTitle>
              <ItemActions>{renderStatus(check.status)}</ItemActions>
            </ItemHeader>
            <ItemDescription>{check.notes ?? "No notes recorded."}</ItemDescription>
            <DutyCheckEvidence check={check} canManage={canManage} uploadingId={uploadingId} onUpload={onUpload} />
            <ItemFooter>
              <DutyCheckAction check={check} canManage={canManage} onComplete={onComplete} />
            </ItemFooter>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}

interface DutyCheckGridProps {
  checks: DutyCheckRow[];
  canManage: boolean;
  uploadingId: string | null;
  onUpload: DutyEvidenceUpload;
  onComplete: (id: string) => Promise<void>;
}

function DutyCheckGrid({ checks, canManage, uploadingId, onUpload, onComplete }: DutyCheckGridProps) {
  return (
    <div data-testid="duty-check-grid" className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {checks.map((check) => (
        <Card key={check.id} data-testid="duty-check-card" className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle data-testid="duty-check-date" className="text-base">
                {formatDutyDate(check.duty_date)}
              </CardTitle>
              {renderStatus(check.status)}
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <DutyCheckEvidence check={check} canManage={canManage} uploadingId={uploadingId} onUpload={onUpload} />
            {check.notes ? <p className="text-muted-foreground text-xs">{check.notes.slice(0, 120)}</p> : null}
            <div className="mt-auto flex items-center justify-end">
              <DutyCheckAction check={check} canManage={canManage} onComplete={onComplete} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SecurityDutyChecksClient({ checks, canManage }: SecurityDutyChecksClientProps) {
  const router = useRouter();
  const [view, setView] = useState<DutyCheckView>("table");
  const [formOpen, setFormOpen] = useState(false);
  const [dutyDate, setDutyDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  async function submitStart() {
    setLoading(true);
    setFormError(null);
    const fd = new FormData();
    fd.set("duty_date", dutyDate);
    const result = await startDutyCheck(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setFormError(result.error);
      return;
    }
    toast.success("Duty check started.");
    setFormOpen(false);
    setDutyDate("");
    router.refresh();
  }

  const submitUpload = useCallback<DutyEvidenceUpload>(
    async (id, slot, file) => {
      setUploadingId(`${id}-${slot}`);
      const fd = new FormData();
      fd.set("duty_check_id", id);
      fd.set("slot", slot);
      fd.set("image", file);
      const result = await uploadDutyEvidence(fd);
      setUploadingId(null);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(slot === "before" ? "Before image uploaded." : "After image uploaded.");
      router.refresh();
    },
    [router],
  );

  const submitComplete = useCallback(
    async (id: string) => {
      const fd = new FormData();
      fd.set("duty_check_id", id);
      const result = await completeDutyCheck(fd);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Duty check completed.");
      router.refresh();
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Security Duty Checks</h1>
          <p className="text-muted-foreground text-sm">Before-and-after evidence for security shifts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => {
              if (isDutyCheckView(value)) setView(value);
            }}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Duty check view"
          >
            <ToggleGroupItem value="table" aria-label="Table">
              <Table2 data-icon="inline-start" />
              Table
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List">
              <List data-icon="inline-start" />
              List
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid">
              <Grid2X2 data-icon="inline-start" />
              Grid
            </ToggleGroupItem>
          </ToggleGroup>
          {canManage ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus data-icon="inline-start" />
              Start Check
            </Button>
          ) : null}
        </div>
      </div>

      {checks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Camera className="size-8 text-muted-foreground" />
            <p className="text-muted-foreground">No duty checks recorded.</p>
          </CardContent>
        </Card>
      ) : view === "table" ? (
        <DutyCheckTable
          checks={checks}
          canManage={canManage}
          uploadingId={uploadingId}
          onUpload={submitUpload}
          onComplete={submitComplete}
        />
      ) : view === "list" ? (
        <DutyCheckList
          checks={checks}
          canManage={canManage}
          uploadingId={uploadingId}
          onUpload={submitUpload}
          onComplete={submitComplete}
        />
      ) : (
        <DutyCheckGrid
          checks={checks}
          canManage={canManage}
          uploadingId={uploadingId}
          onUpload={submitUpload}
          onComplete={submitComplete}
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Duty Check</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Duty Date</FieldLabel>
              <Input type="date" value={dutyDate} onChange={(event) => setDutyDate(event.target.value)} />
            </Field>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitStart} disabled={loading}>
              {loading ? "Starting..." : "Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
