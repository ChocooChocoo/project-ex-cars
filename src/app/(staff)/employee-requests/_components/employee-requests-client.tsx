"use client";
"use no memo";

import { useCallback, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { getCoreRowModel, getPaginationRowModel, type PaginationState, useReactTable } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  cancelEmployeeRequest,
  reviewEmployeeRequest,
  submitEmployeeRequest,
} from "@/app/(staff)/employee-requests/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_KINDS, type RequestKind } from "@/lib/validation/phase6";

import { createEmployeeRequestColumns, type EmployeeRequestRow, KIND_LABELS } from "./employee-requests-columns";

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
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<EmployeeRequestRow | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  async function submitForm() {
    setLoading(true);
    setFormError(null);
    const fd = new FormData();
    fd.set("request_kind", kind);
    fd.set("start_date", startDate);
    fd.set("end_date", endDate);
    fd.set("reason", reason);
    const result = await submitEmployeeRequest(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setFormError(result.error);
      return;
    }
    toast.success("Request submitted.");
    setFormOpen(false);
    setReason("");
    setEndDate("");
    router.refresh();
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
    state: { pagination },
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

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
        <CardContent className="px-0 pb-0">
          <DataTable table={table} rowsPerPageId="employee-requests-rows-per-page" />
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Request</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Request Type</FieldLabel>
              <Select value={kind} onValueChange={(value) => setKind(value as RequestKind)}>
                <SelectTrigger>
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
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Start Date</FieldLabel>
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel>End Date</FieldLabel>
                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Reason</FieldLabel>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Why are you requesting this?"
              />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review request</DialogTitle>
          </DialogHeader>
          {reviewTarget ? (
            <FieldGroup className="gap-4">
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{KIND_LABELS[reviewTarget.request_kind]}</p>
                <p className="text-muted-foreground">
                  {new Date(reviewTarget.start_date).toLocaleDateString()}
                  {reviewTarget.end_date ? ` – ${new Date(reviewTarget.end_date).toLocaleDateString()}` : ""}
                </p>
                <p className="mt-1 text-muted-foreground">{reviewTarget.reason}</p>
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
