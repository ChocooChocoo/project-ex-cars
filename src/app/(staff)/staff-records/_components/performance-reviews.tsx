"use client";
"use no memo";

import * as React from "react";

import { useRouter } from "next/navigation";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type PaginationState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { ChevronDownIcon, ListFilter, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

import { submitPerformanceReview, updatePerformanceReview } from "@/app/(staff)/staff-records/actions";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface PerformanceReviewRow {
  id: string;
  employee_id: string;
  reviewer_id: string;
  review_period_start: string;
  review_period_end: string;
  rating: number | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  goals: string | null;
  status: "draft" | "submitted" | "acknowledged";
  profiles: { full_name: string | null } | null;
  reviewers: { full_name: string | null } | null;
}

interface PerformanceReviewsProps {
  reviews: PerformanceReviewRow[];
  employees: { id: string; full_name: string | null }[];
  canManage: boolean;
}

const statusOptions = ["all", "draft", "submitted", "acknowledged"] as const;
const ratingOptions = ["all", "5", "4", "3", "2", "1"] as const;

const ratingStripSlots = Array.from({ length: 5 }, (_, index) => ({
  id: `slot-${index + 1}`,
  threshold: index + 1,
}));

function getRatingScore(rating: number | null) {
  if (!rating) return 0;
  return Math.max(0, Math.min(5, rating));
}

const performanceReviewColumns = (
  onEdit: (review: PerformanceReviewRow) => void,
): ColumnDef<PerformanceReviewRow>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all reviews"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={`Select ${row.original.profiles?.full_name ?? "review"}`}
      />
    ),
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div className="text-sm tracking-tight">{row.original.id.slice(0, 8)}</div>,
    enableHiding: false,
  },
  {
    accessorKey: "profiles",
    header: "Employee",
    cell: ({ row }) => (
      <div className="font-medium text-sm">
        {row.original.profiles?.full_name ?? row.original.employee_id.slice(0, 8)}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline" className="rounded-full px-2.5">
        {row.original.status}
      </Badge>
    ),
    filterFn: "equalsString",
  },
  {
    id: "period",
    accessorFn: (row) => `${row.review_period_start} ${row.review_period_end}`,
    header: "Period",
    cell: ({ row }) => (
      <div className="text-sm">
        {format(parseISO(row.original.review_period_start), "MMM d, yyyy")} –{" "}
        {format(parseISO(row.original.review_period_end), "MMM d, yyyy")}
      </div>
    ),
  },
  {
    accessorKey: "rating",
    header: "Rating",
    cell: ({ row }) => (
      <div className="flex items-end gap-0.5" title={row.original.rating ? `${row.original.rating}/5` : "No rating"}>
        <span className="sr-only">{row.original.rating ? `${row.original.rating}/5` : "No rating"}</span>
        {ratingStripSlots.map((slot) => (
          <div
            key={`${row.original.id}-${slot.id}`}
            className={cn(
              "h-5 w-1 rounded-full",
              slot.threshold <= getRatingScore(row.original.rating) ? "bg-green-500/85" : "bg-green-500/15",
            )}
          />
        ))}
      </div>
    ),
    filterFn: "equalsString",
  },
  {
    accessorKey: "reviewers",
    header: "Reviewer",
    cell: ({ row }) => (
      <div className="font-medium text-sm tabular-nums">
        {row.original.reviewers?.full_name ?? row.original.reviewer_id.slice(0, 8)}
      </div>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const review = row.original;
      const name = review.profiles?.full_name ?? review.employee_id.slice(0, 8);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`More actions for ${name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(review)}>Edit</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableHiding: false,
  },
];

function preventPaginationNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

export function PerformanceReviews({ reviews, employees, canManage }: PerformanceReviewsProps) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility] = React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [open, setOpen] = React.useState(false);
  const [editingReview, setEditingReview] = React.useState<PerformanceReviewRow | null>(null);
  const [employeeId, setEmployeeId] = React.useState("");
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [rating, setRating] = React.useState("");
  const [strengths, setStrengths] = React.useState("");
  const [areas, setAreas] = React.useState("");
  const [goals, setGoals] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  function resetForm() {
    setEmployeeId("");
    setPeriodStart("");
    setPeriodEnd("");
    setRating("");
    setStrengths("");
    setAreas("");
    setGoals("");
    setError(null);
  }

  function openNewReview() {
    setEditingReview(null);
    resetForm();
    setOpen(true);
  }

  const openEditReview = React.useCallback((review: PerformanceReviewRow) => {
    setEditingReview(review);
    setEmployeeId(review.employee_id);
    setPeriodStart(review.review_period_start);
    setPeriodEnd(review.review_period_end);
    setRating(review.rating ? `${review.rating}` : "");
    setStrengths(review.strengths ?? "");
    setAreas(review.areas_for_improvement ?? "");
    setGoals(review.goals ?? "");
    setError(null);
    setOpen(true);
  }, []);

  const columns = React.useMemo(() => performanceReviewColumns(openEditReview), [openEditReview]);
  const table = useReactTable({
    data: reviews,
    columns,
    state: {
      rowSelection,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "includesString",
  });
  const searchQuery = table.getState().globalFilter ?? "";
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const ratingFilter = (table.getColumn("rating")?.getFilterValue() as string) ?? "all";
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageCount = table.getPageCount();
  const filteredReviewCount = table.getFilteredRowModel().rows.length;
  const visibleReviewCount = table.getRowModel().rows.length;
  const pageNumbers = React.useMemo(() => {
    if (pageCount <= 3) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }

    if (currentPage <= 2) return [1, 2, 3];
    if (currentPage >= pageCount - 1) return [pageCount - 2, pageCount - 1, pageCount];

    return [currentPage - 1, currentPage, currentPage + 1];
  }, [currentPage, pageCount]);

  async function handleSubmit() {
    if (!employeeId || !periodStart || !periodEnd) {
      setError("Employee, period start, and period end are required.");
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    if (editingReview) fd.set("review_id", editingReview.id);
    fd.set("employee_id", employeeId);
    fd.set("review_period_start", periodStart);
    fd.set("review_period_end", periodEnd);
    if (rating) fd.set("rating", rating);
    if (strengths) fd.set("strengths", strengths);
    if (areas) fd.set("areas_for_improvement", areas);
    if (goals) fd.set("goals", goals);
    const result = editingReview ? await updatePerformanceReview(fd) : await submitPerformanceReview(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    toast.success(editingReview ? "Performance review updated." : "Performance review submitted.");
    setOpen(false);
    resetForm();
    router.refresh();
  }

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none">Performance Reviews</CardTitle>
          <CardDescription>
            Track employee review cycles from draft to acknowledged with their latest ratings.
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Input
                className="h-7 w-44 md:w-52"
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(event) => {
                  table.setGlobalFilter(event.target.value || undefined);
                  table.setPageIndex(0);
                }}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ListFilter data-icon="inline-start" />
                    Status
                    <ChevronDownIcon data-icon="inline-end" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuRadioGroup
                    value={statusFilter}
                    onValueChange={(value) => {
                      table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
                      table.setPageIndex(0);
                    }}
                  >
                    {statusOptions.map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {option === "all" ? "All statuses" : option}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ListFilter data-icon="inline-start" />
                    Rating
                    <ChevronDownIcon data-icon="inline-end" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuRadioGroup
                    value={ratingFilter}
                    onValueChange={(value) => {
                      table.getColumn("rating")?.setFilterValue(value === "all" ? undefined : value);
                      table.setPageIndex(0);
                    }}
                  >
                    {ratingOptions.map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {option === "all" ? "All ratings" : option}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {canManage ? (
                <Button size="sm" onClick={openNewReview}>
                  <Plus data-icon="inline-start" />
                  New Review
                </Button>
              ) : null}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="overflow-hidden">
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4 **:data-[slot='table-cell']:py-4">
              <TableHeader className="border-t **:data-[slot='table-head']:h-11 **:data-[slot='table-head']:font-medium **:data-[slot='table-head']:text-foreground **:data-[slot='table-head']:text-sm">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot='table-row']:border-border/50 **:data-[slot='table-row']:hover:bg-transparent">
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
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
          <div className="flex items-center justify-between gap-4 px-4 pb-1">
            <p className="text-muted-foreground text-sm">
              Viewing {visibleReviewCount} out of {filteredReviewCount.toLocaleString()} reviews
            </p>

            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent className="gap-1.5">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      preventPaginationNavigation(event);
                      table.previousPage();
                    }}
                  />
                </PaginationItem>
                {pageNumbers[0] > 1 ? (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : null}
                {pageNumbers.map((pageNumber) => (
                  <PaginationItem key={`page-${pageNumber}`}>
                    <PaginationLink
                      href="#"
                      isActive={table.getState().pagination.pageIndex === pageNumber - 1}
                      onClick={(event) => {
                        preventPaginationNavigation(event);
                        table.setPageIndex(pageNumber - 1);
                      }}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                {pageNumbers[pageNumbers.length - 1] < pageCount ? (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : null}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      preventPaginationNavigation(event);
                      table.nextPage();
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && setOpen(false)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{editingReview ? "Edit Performance Review" : "New Performance Review"}</SheetTitle>
            <SheetDescription>
              {editingReview
                ? `Update the review for ${editingReview.profiles?.full_name ?? editingReview.employee_id.slice(0, 8)}.`
                : "Record a review cycle for an employee with their latest rating."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <Field>
              <FieldLabel>Employee</FieldLabel>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name ?? emp.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Period Start</FieldLabel>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Period End</FieldLabel>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Rating (1–5, optional)</FieldLabel>
              <Input
                type="number"
                min="1"
                max="5"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="e.g. 4"
              />
            </Field>
            <Field>
              <FieldLabel>Strengths</FieldLabel>
              <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} />
            </Field>
            <Field>
              <FieldLabel>Areas for Improvement</FieldLabel>
              <Textarea value={areas} onChange={(e) => setAreas(e.target.value)} rows={2} />
            </Field>
            <Field>
              <FieldLabel>Goals</FieldLabel>
              <Textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} />
            </Field>
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
          </div>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : editingReview ? "Save Changes" : "Submit Review"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
