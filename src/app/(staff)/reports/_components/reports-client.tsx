"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Check, Plus } from "lucide-react";
import { toast } from "sonner";

import { reviewReport, submitReport } from "@/app/(staff)/reports/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_KINDS, type ReportKind } from "@/lib/validation/phase6";

const KIND_LABELS: Record<ReportKind, string> = {
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

export interface ReportRow {
  id: string;
  title: string;
  report_kind: ReportKind;
  description: string | null;
  status: "draft" | "submitted" | "reviewed" | "archived";
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

interface ReportsClientProps {
  reports: ReportRow[];
  canCreate: boolean;
  canReview: boolean;
}

export function ReportsClient({ reports, canCreate, canReview }: ReportsClientProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<ReportKind>("revenue");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitForm() {
    setLoading(true);
    setFormError(null);
    const fd = new FormData();
    fd.set("report_kind", kind);
    fd.set("title", title);
    fd.set("description", description);
    fd.set("period_start", periodStart);
    fd.set("period_end", periodEnd);
    const result = await submitReport(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setFormError(result.error);
      return;
    }
    toast.success("Report submitted.");
    setFormOpen(false);
    setTitle("");
    setDescription("");
    setPeriodStart("");
    setPeriodEnd("");
    router.refresh();
  }

  async function submitReview(reportId: string) {
    const fd = new FormData();
    fd.set("report_id", reportId);
    const result = await reviewReport(fd);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Report marked as reviewed.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm">Financial and operational report submissions.</p>
        </div>
        {canCreate ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus data-icon="inline-start" />
            Submit Report
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Title</th>
                  <th className="px-2 py-2 font-medium">Kind</th>
                  <th className="px-2 py-2 font-medium">Period</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  {canReview ? <th className="px-2 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={canReview ? 5 : 4} className="px-2 py-6 text-center text-muted-foreground">
                      No reports submitted.
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className="border-b last:border-0">
                      <td className="px-2 py-2 font-medium">{report.title}</td>
                      <td className="px-2 py-2">
                        <Badge variant="secondary" className="capitalize">
                          {KIND_LABELS[report.report_kind]}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {report.period_start ? `${new Date(report.period_start).toLocaleDateString()} — ` : ""}
                        {report.period_end ? new Date(report.period_end).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant={report.status === "reviewed" ? "default" : "secondary"}>{report.status}</Badge>
                      </td>
                      {canReview ? (
                        <td className="px-2 py-2 text-right">
                          {report.status === "submitted" ? (
                            <Button variant="ghost" size="sm" onClick={() => submitReview(report.id)}>
                              <Check data-icon="inline-start" />
                              Mark Reviewed
                            </Button>
                          ) : null}
                        </td>
                      ) : null}
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
            <DialogTitle>Submit Report</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Report Kind</FieldLabel>
              <Select value={kind} onValueChange={(value) => setKind(value as ReportKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {REPORT_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Title</FieldLabel>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q3 Expense Summary" />
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
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
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitForm} disabled={loading}>
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
