"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { CalendarClock, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  cancelEmployeeRequest,
  reviewEmployeeRequest,
  submitEmployeeRequest,
} from "@/app/(staff)/employee-requests/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_KINDS, type RequestKind } from "@/lib/validation/phase6";

const KIND_LABELS: Record<RequestKind, string> = {
  leave: "Leave",
  overtime: "Overtime",
  schedule_change: "Schedule Change",
  other: "Other",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
};

export interface EmployeeRequestRow {
  id: string;
  employee_id: string;
  request_kind: RequestKind;
  status: "pending" | "approved" | "rejected" | "cancelled";
  start_date: string;
  end_date: string | null;
  reason: string;
  review_notes: string | null;
  reviewed_at: string | null;
}

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

  async function submitCancel(requestId: string) {
    const fd = new FormData();
    fd.set("request_id", requestId);
    const result = await cancelEmployeeRequest(fd);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Request cancelled.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Employee Requests</h1>
          <p className="text-muted-foreground text-sm">Leave, overtime, and schedule change requests.</p>
        </div>
        {canSubmit ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus data-icon="inline-start" />
            New Request
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{canReview ? "All Requests" : "My Requests"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Start</th>
                  <th className="px-2 py-2 font-medium">End</th>
                  <th className="px-2 py-2 font-medium">Reason</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  {canReview ? <th className="px-2 py-2 font-medium">Reviewed</th> : null}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={canReview ? 7 : 6} className="px-2 py-6 text-center text-muted-foreground">
                      No requests found.
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-1.5">
                          <CalendarClock className="size-3.5 text-muted-foreground" />
                          {KIND_LABELS[request.request_kind]}
                        </span>
                      </td>
                      <td className="px-2 py-2">{new Date(request.start_date).toLocaleDateString()}</td>
                      <td className="px-2 py-2">
                        {request.end_date ? new Date(request.end_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="max-w-64 truncate px-2 py-2 text-muted-foreground">{request.reason}</td>
                      <td className="px-2 py-2">
                        <Badge variant={STATUS_VARIANTS[request.status]}>{request.status}</Badge>
                      </td>
                      {canReview ? (
                        <td className="px-2 py-2 text-muted-foreground">
                          {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : "—"}
                        </td>
                      ) : null}
                      <td className="px-2 py-2 text-right">
                        {canReview && request.status === "pending" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReviewTarget(request);
                              setReviewNotes("");
                              setReviewError(null);
                            }}
                          >
                            <Check data-icon="inline-start" />
                            Review
                          </Button>
                        ) : null}
                        {!canReview && request.status === "pending" ? (
                          <Button variant="ghost" size="sm" onClick={() => submitCancel(request.id)}>
                            <X data-icon="inline-start" />
                            Cancel
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                    {REQUEST_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Start Date</FieldLabel>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>End Date</FieldLabel>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Reason</FieldLabel>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
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
                <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} />
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
