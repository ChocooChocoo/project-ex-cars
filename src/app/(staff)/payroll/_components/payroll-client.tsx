"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  createPayrollRun,
  finalizePayrollRun,
  reviewPayrollRun,
  saveCompensation,
} from "@/app/(staff)/payroll/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { type CompensationRow, CompensationTable, type PayrollRunRow, PayrollRunsTable } from "./payroll-tables";

export type { CompensationRow, PayrollRunRow } from "./payroll-tables";

interface PayrollClientProps {
  runs: PayrollRunRow[];
  compensation: CompensationRow[];
  employees: { id: string; full_name: string | null }[];
  canPrepare: boolean;
  canReview: boolean;
  canFinalize: boolean;
}

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
        <CardContent className="pt-0">
          {compensation.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No compensation records yet. The Account Manager enters base salary and effective periods here — these
              feed draft payroll runs.
            </p>
          ) : (
            <CompensationTable data={compensation} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payroll runs yet.</p>
          ) : (
            <PayrollRunsTable
              data={runs}
              canReview={canReview}
              canFinalize={canFinalize}
              onReview={submitReview}
              onFinalize={submitFinalize}
            />
          )}
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
