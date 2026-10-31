"use client";
"use no memo";

import { type ChangeEvent, useCallback, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
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
  Plus,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelEmployeeRequest,
  prepareRequestUploads,
  reviewEmployeeRequest,
  submitEmployeeRequest,
} from "@/app/(staff)/employee-requests/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  attachmentError,
  attachmentMimeType,
  MESSAGE_ATTACHMENT_ACCEPT,
  REQUEST_ATTACHMENT_MAX_COUNT,
  REQUEST_ATTACHMENTS_BUCKET,
} from "@/lib/inquiries/attachments";
import { createClient } from "@/lib/supabase/client";
import { LEAVE_REASONS, type LeaveReason, REQUEST_KINDS, type RequestKind } from "@/lib/validation/phase6";

import {
  createEmployeeRequestColumns,
  type EmployeeRequestRow,
  KIND_LABELS,
  LEAVE_REASON_LABELS,
} from "./employee-requests-columns";

export type { EmployeeRequestRow } from "./employee-requests-columns";

interface EmployeeRequestsClientProps {
  requests: EmployeeRequestRow[];
  canReview: boolean;
  canSubmit: boolean;
}

export function EmployeeRequestsClient({ requests, canReview, canSubmit }: EmployeeRequestsClientProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<RequestKind>("leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [overtimeHours, setOvertimeHours] = useState("");
  const [leaveReason, setLeaveReason] = useState<LeaveReason | "">("");
  const [reason, setReason] = useState("");
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [proofError, setProofError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<EmployeeRequestRow | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "start_date", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [columnVisibility] = useState<VisibilityState>({ search: false, startWindow: false });

  async function submitForm() {
    setFormError(null);
    const isLeave = kind === "leave";
    const isOvertime = kind === "overtime";
    if (isOvertime) {
      const hours = Number(overtimeHours);
      if (!overtimeHours.trim() || !Number.isFinite(hours)) {
        setFormError("Enter the overtime hours.");
        return;
      }
      if (hours < 0.5 || hours > 12) {
        setFormError("Enter between 0.5 and 12 hours.");
        return;
      }
    }
    if (isLeave && !leaveReason) {
      setFormError("Choose a leave reason.");
      return;
    }
    if (isLeave && leaveReason === "others" && !reason.trim()) {
      setFormError("Describe the reason for the leave.");
      return;
    }
    const fileError = proofFiles.map(attachmentError).find((error) => error !== null) ?? null;
    if (fileError) {
      setProofError(fileError);
      return;
    }

    setLoading(true);
    try {
      // The files go straight to storage: a Server Action body is capped at 4 MB.
      const prepared = await prepareRequestUploads(
        proofFiles.map((file) => ({ name: file.name, type: file.type, size: file.size })),
      );
      if ("error" in prepared) {
        setFormError(prepared.error);
        return;
      }

      const bucket = createClient().storage.from(REQUEST_ATTACHMENTS_BUCKET);
      const proofs: { path: string; name: string; type: string; size: number }[] = [];
      for (const [index, file] of proofFiles.entries()) {
        const { path, token } = prepared.uploads[index];
        const type = attachmentMimeType(file);
        const { error } = await bucket.uploadToSignedUrl(path, token, file, { contentType: type });
        if (error) {
          setFormError(`${error.message} Your request was not saved — please try again.`);
          return;
        }
        proofs.push({ path, name: file.name, type, size: file.size });
      }

      const fd = new FormData();
      fd.set("request_kind", kind);
      fd.set("start_date", startDate);
      if (isOvertime) {
        fd.set("overtime_hours", overtimeHours);
      } else {
        fd.set("end_date", endDate);
      }
      if (isLeave) {
        fd.set("leave_reason", leaveReason);
        if (leaveReason === "others") fd.set("reason", reason);
      } else if (!isOvertime) {
        fd.set("reason", reason);
      }
      if (proofs.length > 0) fd.set("proofs", JSON.stringify(proofs));

      const result = await submitEmployeeRequest(fd);
      if ("error" in result && result.error) {
        setFormError(result.error);
        return;
      }
      toast.success("Request submitted.");
      setFormOpen(false);
      setReason("");
      setLeaveReason("");
      setEndDate("");
      setOvertimeHours("");
      setProofFiles([]);
      setProofError(null);
      router.refresh();
    } catch {
      setFormError("Upload failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleProofChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = [...proofFiles, ...Array.from(event.target.files ?? [])];
    const next = picked.slice(0, REQUEST_ATTACHMENT_MAX_COUNT);
    const overLimit = picked.length > REQUEST_ATTACHMENT_MAX_COUNT;
    setProofFiles(next);
    setProofError(
      overLimit
        ? `Attach at most ${REQUEST_ATTACHMENT_MAX_COUNT} files.`
        : (next.map(attachmentError).find((error) => error !== null) ?? null),
    );
    event.target.value = "";
  }

  async function submitReview(decision: "approved" | "rejected") {
    if (!reviewTarget) return;
    setLoading(true);
    setReviewError(null);
    const fd = new FormData();
    fd.set("request_id", reviewTarget.id);
    fd.set("decision", decision);
    fd.set("review_notes", reviewNotes);
    const result = await reviewEmployeeRequest(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setReviewError(result.error);
      return;
    }
    toast.success(decision === "approved" ? "Request approved." : "Request rejected.");
    setReviewTarget(null);
    setReviewNotes("");
    router.refresh();
  }

  const submitCancel = useCallback(
    async (requestId: string) => {
      const fd = new FormData();
      fd.set("request_id", requestId);
      const result = await cancelEmployeeRequest(fd);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Request cancelled.");
      router.refresh();
    },
    [router],
  );

  const columns = useMemo(
    () =>
      createEmployeeRequestColumns({
        canReview,
        onCancel: submitCancel,
        onReview: (request) => {
          setReviewTarget(request);
          setReviewNotes("");
          setReviewError(null);
        },
      }),
    [canReview, submitCancel],
  );

  const table = useReactTable({
    data: requests,
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
  const startDateFilter = (table.getColumn("startWindow")?.getFilterValue() as string) ?? "all";
  const kindFilter = (table.getColumn("request_kind")?.getFilterValue() as string) ?? "all";
  const sortValue = useMemo(() => {
    const currentSort = sorting[0];
    if (!currentSort) return "newest";
    if (currentSort.id === "start_date" && currentSort.desc) return "newest";
    if (currentSort.id === "start_date" && !currentSort.desc) return "oldest";
    if (currentSort.id === "request_kind" && !currentSort.desc) return "name-asc";
    if (currentSort.id === "request_kind" && currentSort.desc) return "name-desc";
    return "newest";
  }, [sorting]);

  const startDateOptions = [
    { value: "all", label: "All time" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
  ] as const;
  const statusOptions = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "cancelled", label: "Cancelled" },
  ] as const;
  const kindOptions = [
    { value: "all", label: "All" },
    ...REQUEST_KINDS.map((requestKind) => ({ value: requestKind, label: KIND_LABELS[requestKind] })),
  ];
  const sortOptions = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "name-asc", label: "Type A-Z" },
    { value: "name-desc", label: "Type Z-A" },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-semibold text-3xl tracking-tight">Employee Requests</h1>
          <p className="text-muted-foreground text-sm">Leave, overtime, and schedule change requests.</p>
        </div>
        {canSubmit ? (
          <Button className="self-start sm:self-auto" onClick={() => setFormOpen(true)}>
            <Plus data-icon="inline-start" />
            New Request
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{canReview ? "All Requests" : "My Requests"}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                    placeholder="Search employee requests..."
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
                  <DropdownMenuContent className="w-35" align="start">
                    <DropdownMenuRadioGroup
                      value={statusFilter}
                      onValueChange={(value) => {
                        table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
                        table.setPageIndex(0);
                      }}
                    >
                      {statusOptions.map((option) => (
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
                      Start date
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-40" align="start">
                    <DropdownMenuRadioGroup
                      value={startDateFilter}
                      onValueChange={(value) => {
                        table.getColumn("startWindow")?.setFilterValue(value === "all" ? undefined : value);
                        table.setPageIndex(0);
                      }}
                    >
                      {startDateOptions.map((option) => (
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
                      Type
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                      value={kindFilter}
                      onValueChange={(value) => {
                        table.getColumn("request_kind")?.setFilterValue(value === "all" ? undefined : value);
                        table.setPageIndex(0);
                      }}
                    >
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
                        const nextSorting: SortingState =
                          value === "oldest"
                            ? [{ id: "start_date", desc: false }]
                            : value === "name-asc"
                              ? [{ id: "request_kind", desc: false }]
                              : value === "name-desc"
                                ? [{ id: "request_kind", desc: true }]
                                : [{ id: "start_date", desc: true }];
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
                  <Label htmlFor="employee-requests-rows-per-page" className="font-medium text-sm">
                    Rows per page
                  </Label>
                  <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => table.setPageSize(Number(value))}
                  >
                    <SelectTrigger size="sm" className="w-20" id="employee-requests-rows-per-page">
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Request</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="request-kind">Request Type</FieldLabel>
              <Select
                value={kind}
                onValueChange={(value) => {
                  const nextKind = value as RequestKind;
                  setKind(nextKind);
                  if (nextKind !== "leave") setLeaveReason("");
                  setFormError(null);
                }}
              >
                <SelectTrigger id="request-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {REQUEST_KINDS.map((requestKind) => (
                      <SelectItem key={requestKind} value={requestKind}>
                        {KIND_LABELS[requestKind]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="request-start-date">{kind === "overtime" ? "Date" : "Start Date"}</FieldLabel>
                <Input
                  id="request-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </Field>
              {kind === "overtime" ? (
                <Field>
                  <FieldLabel htmlFor="request-overtime-hours">Hours</FieldLabel>
                  <Input
                    id="request-overtime-hours"
                    type="number"
                    inputMode="decimal"
                    step={0.5}
                    min={0.5}
                    max={12}
                    value={overtimeHours}
                    onChange={(event) => setOvertimeHours(event.target.value)}
                    aria-describedby="request-overtime-help"
                  />
                  <FieldDescription id="request-overtime-help">
                    Between 0.5 and 12 hours, in 0.5 steps.
                  </FieldDescription>
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="request-end-date">End Date</FieldLabel>
                  <Input
                    id="request-end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </Field>
              )}
            </div>
            {kind === "leave" ? (
              <Field>
                <FieldLabel htmlFor="request-leave-reason">Leave reason</FieldLabel>
                <Select value={leaveReason} onValueChange={(value) => setLeaveReason(value as LeaveReason)}>
                  <SelectTrigger id="request-leave-reason" className="w-full">
                    <SelectValue placeholder="Choose a leave reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {LEAVE_REASONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {LEAVE_REASON_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {kind !== "overtime" && (kind !== "leave" || leaveReason === "others") ? (
              <Field>
                <FieldLabel htmlFor="request-reason">{kind === "leave" ? "Describe the reason" : "Reason"}</FieldLabel>
                <Textarea
                  id="request-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder="Add the details the Account Manager needs."
                />
              </Field>
            ) : null}
            <Field data-invalid={!!proofError}>
              <FieldLabel htmlFor="request-proof-files">
                Proof files (optional, up to {REQUEST_ATTACHMENT_MAX_COUNT})
              </FieldLabel>
              <Input
                id="request-proof-files"
                type="file"
                multiple
                accept={MESSAGE_ATTACHMENT_ACCEPT}
                onChange={handleProofChange}
                aria-invalid={!!proofError}
              />
              <FieldDescription>JPG, PNG, WebP or PDF, 10 MB each.</FieldDescription>
              {proofError ? <FieldError errors={[{ message: proofError }]} /> : null}
              {proofFiles.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Proof files to upload">
                  {proofFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="flex max-w-full items-center gap-1 rounded-md border bg-muted/30 py-1 pr-1 pl-2 text-xs"
                    >
                      <span className="max-w-48 truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => {
                          const next = proofFiles.filter((_, fileIndex) => fileIndex !== index);
                          setProofFiles(next);
                          setProofError(next.map(attachmentError).find((error) => error !== null) ?? null);
                        }}
                      >
                        <X className="size-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Field>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitForm} disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reviewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setReviewTarget(null);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review request</DialogTitle>
          </DialogHeader>
          {reviewTarget ? (
            <FieldGroup className="gap-4">
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{KIND_LABELS[reviewTarget.request_kind]}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">Employee</dt>
                  <dd className="font-medium">{reviewTarget.employee_name ?? "Unknown employee"}</dd>
                  <dt className="text-muted-foreground">
                    {reviewTarget.request_kind === "overtime" ? "Date" : "Dates"}
                  </dt>
                  <dd>
                    {new Date(reviewTarget.start_date).toLocaleDateString()}
                    {reviewTarget.end_date ? ` – ${new Date(reviewTarget.end_date).toLocaleDateString()}` : ""}
                  </dd>
                  {reviewTarget.request_kind === "overtime" && reviewTarget.overtime_hours != null ? (
                    <>
                      <dt className="text-muted-foreground">Hours</dt>
                      <dd>{Number(reviewTarget.overtime_hours)} h</dd>
                    </>
                  ) : null}
                  {reviewTarget.leave_reason ? (
                    <>
                      <dt className="text-muted-foreground">Leave reason</dt>
                      <dd>{LEAVE_REASON_LABELS[reviewTarget.leave_reason]}</dd>
                    </>
                  ) : null}
                  {reviewTarget.reason ? (
                    <>
                      <dt className="text-muted-foreground">Reason</dt>
                      <dd className="break-words">{reviewTarget.reason}</dd>
                    </>
                  ) : null}
                </dl>
                <div className="mt-3">
                  <p className="text-muted-foreground">Proof files</p>
                  {reviewTarget.employee_request_attachments.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-1" aria-label="Proof files">
                      {reviewTarget.employee_request_attachments.map((attachment) => (
                        <li key={attachment.id}>
                          {attachment.signed_url ? (
                            <a
                              className="font-medium underline underline-offset-3 hover:no-underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                              href={attachment.signed_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {attachment.original_name}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">{attachment.original_name}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-muted-foreground">No proof files.</p>
                  )}
                </div>
              </div>
              <Field>
                <FieldLabel>Review Notes</FieldLabel>
                <Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} />
              </Field>
              {reviewError ? <p className="text-destructive text-sm">{reviewError}</p> : null}
            </FieldGroup>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReviewTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => submitReview("rejected")} disabled={loading}>
              Reject
            </Button>
            <Button type="button" onClick={() => submitReview("approved")} disabled={loading}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
