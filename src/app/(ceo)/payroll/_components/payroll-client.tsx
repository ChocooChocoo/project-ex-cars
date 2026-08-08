"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Check, CheckCheck, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { createPayrollRun, finalizePayrollRun, reviewPayrollRun } from "@/app/(ceo)/payroll/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

interface PayrollClientProps {
  runs: PayrollRunRow[];
  canPrepare: boolean;
  canReview: boolean;
  canFinalize: boolean;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  pending_approval: "secondary",
  approved: "default",
  finalized: "default",
  cancelled: "destructive",
};

export function PayrollClient({ runs, canPrepare, canReview, canFinalize }: PayrollClientProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitCreate() {
    setLoading(true);
    setFormError(null);
    const fd = new FormData();
    fd.set("period_start", periodStart);
    fd.set("period_end", periodEnd);
    fd.set("notes", notes);
    const result = await createPayrollRun(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setFormError(result.error);
      return;
    }
    toast.success("Payroll run created from checked attendance.");
    setFormOpen(false);
    setPeriodStart("");
    setPeriodEnd("");
    setNotes("");
    router.refresh();
  }

  async function submitReview(runId: string, decision: "approved" | "rejected") {
    const fd = new FormData();
    fd.set("payroll_run_id", runId);
    fd.set("decision", decision);
    const result = await reviewPayrollRun(fd);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(decision === "approved" ? "Run approved." : "Run rejected and returned to draft.");
    router.refresh();
  }

  async function submitFinalize(runId: string) {
    const fd = new FormData();
    fd.set("payroll_run_id", runId);
    const result = await finalizePayrollRun(fd);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Run finalized. Payslips are now final.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Payroll</h1>
          <p className="text-muted-foreground text-sm">
            Prepare runs from checked attendance, review in order, and finalize payslips.
          </p>
        </div>
        {canPrepare ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus data-icon="inline-start" />
            Create Run
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Period</th>
                  <th className="px-2 py-2 font-medium">Gross</th>
                  <th className="px-2 py-2 font-medium">Deductions</th>
                  <th className="px-2 py-2 font-medium">Net</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                      No payroll runs yet.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id} className="border-b last:border-0">
                      <td className="px-2 py-2 font-medium">
                        {new Date(run.period_start).toLocaleDateString()} —{" "}
                        {new Date(run.period_end).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-2">₱{(run.total_gross_cents / 100).toLocaleString()}</td>
                      <td className="px-2 py-2">₱{(run.total_deductions_cents / 100).toLocaleString()}</td>
                      <td className="px-2 py-2 font-medium">₱{(run.total_net_cents / 100).toLocaleString()}</td>
                      <td className="px-2 py-2">
                        <Badge variant={STATUS_VARIANTS[run.status]}>{run.status.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {canReview && (run.status === "draft" || run.status === "pending_approval") ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => submitReview(run.id, "rejected")}>
                                <X data-icon="inline-start" />
                                Reject
                              </Button>
                              <Button size="sm" onClick={() => submitReview(run.id, "approved")}>
                                <Check data-icon="inline-start" />
                                Approve
                              </Button>
                            </>
                          ) : null}
                          {canFinalize && run.status === "approved" ? (
                            <Button size="sm" onClick={() => submitFinalize(run.id)}>
                              <CheckCheck data-icon="inline-start" />
                              Finalize
                            </Button>
                          ) : null}
                        </div>
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
            <DialogTitle>Create Payroll Run</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
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
              <FieldLabel>Notes</FieldLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </Field>
            <p className="text-muted-foreground text-xs">
              Draft payslips are generated only from checked attendance and active compensation records for the period.
            </p>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitCreate} disabled={loading}>
              {loading ? "Creating..." : "Create Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
