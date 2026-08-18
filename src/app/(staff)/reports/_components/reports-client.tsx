"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { reviewReport, submitReport } from "@/app/(staff)/reports/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_KINDS, type ReportKind } from "@/lib/validation/phase6";

import { ReportsTable } from "./reports-table";
import type { ReportRow } from "./reports-types";

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

export type { ReportRow } from "./reports-types";

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
        <CardContent className="pt-0">
          {reports.length === 0 ? (
            <p className="text-muted-foreground text-sm">No reports submitted.</p>
          ) : (
            <ReportsTable reports={reports} canReview={canReview} onReview={submitReview} />
          )}
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
