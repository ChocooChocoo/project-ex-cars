"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Check, CheckCheck, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  createPayrollRun,
  finalizePayrollRun,
  reviewPayrollRun,
  saveCompensation,
} from "@/app/(staff)/payroll/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export interface CompensationRow {
  id: string;
  employee_id: string;
  base_salary_cents: number;
  effective_from: string;
  effective_until: string | null;
  profiles: { full_name: string | null } | null;
}

interface PayrollClientProps {
  runs: PayrollRunRow[];
  compensation: CompensationRow[];
  employees: { id: string; full_name: string | null }[];
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

export function PayrollClient({
  runs,
  compensation,
  employees,
  canPrepare,
  canReview,
  canFinalize,
}: PayrollClientProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [compOpen, setCompOpen] = useState(false);
  const [compEmployee, setCompEmployee] = useState("");
  const [compSalary, setCompSalary] = useState("");
  const [compFrom, setCompFrom] = useState("");
  const [compUntil, setCompUntil] = useState("");
  const [compSss, setCompSss] = useState("");
  const [compPagibig, setCompPagibig] = useState("");
  const [compPhilhealth, setCompPhilhealth] = useState("");
  const [compTin, setCompTin] = useState("");
  const [compError, setCompError] = useState<string | null>(null);
  const [compLoading, setCompLoading] = useState(false);

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

  async function submitCompensation() {
    if (!compEmployee || !compSalary || !compFrom) {
      setCompError("Employee, salary, and effective date are required.");
      return;
    }
    setCompLoading(true);
    setCompError(null);
    const fd = new FormData();
    fd.set("employee_id", compEmployee);
    fd.set("base_salary_cents", String(Math.round(Number.parseFloat(compSalary) * 100)));
    fd.set("effective_from", compFrom);
    if (compUntil) fd.set("effective_until", compUntil);
    fd.set("sss_contribution_cents", compSss ? String(Math.round(Number.parseFloat(compSss) * 100)) : "0");
    fd.set("pagibig_contribution_cents", compPagibig ? String(Math.round(Number.parseFloat(compPagibig) * 100)) : "0");
    fd.set(
      "philhealth_contribution_cents",
      compPhilhealth ? String(Math.round(Number.parseFloat(compPhilhealth) * 100)) : "0",
    );
    if (compTin) fd.set("tin_number", compTin);
    const result = await saveCompensation(fd);
    setCompLoading(false);
    if ("error" in result && result.error) {
      setCompError(result.error);
      return;
    }
    toast.success("Compensation record saved.");
    setCompOpen(false);
    setCompEmployee("");
    setCompSalary("");
    setCompFrom("");
    setCompUntil("");
    setCompSss("");
    setCompPagibig("");
    setCompPhilhealth("");
    setCompTin("");
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Staff Compensation</CardTitle>
          {canPrepare ? (
            <Button size="sm" onClick={() => setCompOpen(true)}>
              <Plus data-icon="inline-start" />
              Add Compensation
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {compensation.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No compensation records yet. The Account Manager enters base salary and effective periods here — these
              feed draft payroll runs.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Employee</th>
                    <th className="px-2 py-2 font-medium">Base Salary (₱/mo)</th>
                    <th className="px-2 py-2 font-medium">Effective</th>
                    <th className="px-2 py-2 font-medium">Until</th>
                  </tr>
                </thead>
                <tbody>
                  {compensation.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-2 py-2 font-medium">
                        {row.profiles?.full_name ?? row.employee_id.slice(0, 8)}
                      </td>
                      <td className="px-2 py-2">₱{(row.base_salary_cents / 100).toLocaleString()}</td>
                      <td className="px-2 py-2">{new Date(row.effective_from).toLocaleDateString()}</td>
                      <td className="px-2 py-2">
                        {row.effective_until ? new Date(row.effective_until).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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

      <Dialog open={compOpen} onOpenChange={setCompOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Compensation Record</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Employee</FieldLabel>
              <Select value={compEmployee} onValueChange={setCompEmployee}>
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
            <Field>
              <FieldLabel>Base Salary per Month (₱)</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={compSalary}
                onChange={(e) => setCompSalary(e.target.value)}
                placeholder="e.g. 15000.00"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Effective From</FieldLabel>
                <Input type="date" value={compFrom} onChange={(e) => setCompFrom(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Effective Until (optional)</FieldLabel>
                <Input type="date" value={compUntil} onChange={(e) => setCompUntil(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field>
                <FieldLabel>SSS / month (₱)</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={compSss}
                  onChange={(e) => setCompSss(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field>
                <FieldLabel>Pag-IBIG / month (₱)</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={compPagibig}
                  onChange={(e) => setCompPagibig(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field>
                <FieldLabel>PhilHealth / month (₱)</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={compPhilhealth}
                  onChange={(e) => setCompPhilhealth(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>TIN Number (optional)</FieldLabel>
              <Input value={compTin} onChange={(e) => setCompTin(e.target.value)} placeholder="123-456-789-000" />
            </Field>
            <p className="text-muted-foreground text-xs">
              Statutory contributions are added automatically as deduction items on draft payslips. Draft payslips
              compute the daily rate as base salary ÷ 30 working days.
            </p>
            {compError ? <p className="text-destructive text-sm">{compError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCompOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitCompensation} disabled={compLoading}>
              {compLoading ? "Saving..." : "Save Compensation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
