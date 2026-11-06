"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { finalizePayrollRun, getPayrollRunDetail, reviewPayrollRun } from "@/app/(staff)/payroll/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Profile = { full_name: string | null } | { full_name: string | null }[] | null;

type PayslipItem = {
  id: string;
  item_kind: string;
  label: string;
  amount_cents: number;
};

type Payslip = {
  id: string;
  employee_id: string;
  gross_cents: number;
  deductions_cents: number;
  net_cents: number;
  status: string;
  profiles?: Profile;
  payslip_items?: PayslipItem[];
};

type Approval = {
  id: string;
  sequence: number;
  decision: string;
  notes: string | null;
  created_at?: string | null;
  profiles?: Profile;
};

type DetailRun = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_gross_cents: number;
  total_deductions_cents: number;
  total_net_cents: number;
  notes: string | null;
  payslips?: Payslip[];
  payroll_approvals?: Approval[];
};

const money = (cents: unknown) => `₱${(Number(cents ?? 0) / 100).toLocaleString()}`;
const nameOf = (profile: Profile | undefined) => {
  const row = Array.isArray(profile) ? profile[0] : profile;
  return row?.full_name ?? "Employee";
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  finalized: "Finalized",
  cancelled: "Cancelled",
};

export function PayrollRunDetailDialog({
  runId,
  open,
  onOpenChange,
  canReview,
  canFinalize,
}: {
  readonly runId: string | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly canReview: boolean;
  readonly canFinalize: boolean;
}) {
  const router = useRouter();
  const [run, setRun] = useState<DetailRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<"approved" | "rejected" | null>(null);

  const load = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    const result = await getPayrollRunDetail(runId);
    setLoading(false);
    if ("error" in result) {
      setError(result.error ?? "Could not load payroll run.");
      setRun(null);
      return;
    }
    setRun(result.run as unknown as DetailRun);
  }, [runId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  async function submitReview(decision: "approved" | "rejected") {
    if (!runId) return;
    const fd = new FormData();
    fd.set("payroll_run_id", runId);
    fd.set("decision", decision);
    const result = await reviewPayrollRun(fd);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(decision === "approved" ? "Run approved." : "Run rejected and returned to draft.");
    router.refresh();
    await load();
  }

  async function submitFinalize() {
    if (!runId) return;
    const fd = new FormData();
    fd.set("payroll_run_id", runId);
    const result = await finalizePayrollRun(fd);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Run finalized. Payslips are now final.");
    router.refresh();
    await load();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {run
                ? `Payroll run · ${new Date(run.period_start).toLocaleDateString()} — ${new Date(run.period_end).toLocaleDateString()}`
                : "Payroll run"}
            </DialogTitle>
            <DialogDescription>
              Review the employees, salary breakdown and date range before approving the run.
            </DialogDescription>
          </DialogHeader>

          {loading ? <p className="text-muted-foreground text-sm">Loading payroll run...</p> : null}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          {run && !loading ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={run.status === "approved" || run.status === "finalized" ? "default" : "secondary"}>
                  {STATUS_LABELS[run.status] ?? run.status.replace(/_/g, " ")}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {run.payslips?.length ?? 0} employee{(run.payslips?.length ?? 0) === 1 ? "" : "s"}
                </span>
              </div>

              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3">
                  <dt className="text-muted-foreground text-xs">Gross</dt>
                  <dd className="font-medium tabular-nums">{money(run.total_gross_cents)}</dd>
                </div>
                <div className="rounded-md border p-3">
                  <dt className="text-muted-foreground text-xs">Deductions</dt>
                  <dd className="font-medium tabular-nums">{money(run.total_deductions_cents)}</dd>
                </div>
                <div className="rounded-md border p-3">
                  <dt className="text-muted-foreground text-xs">Net</dt>
                  <dd className="font-medium tabular-nums">{money(run.total_net_cents)}</dd>
                </div>
              </dl>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="px-3 py-2 font-medium">Employee</th>
                      <th className="px-3 py-2 text-right font-medium">Gross</th>
                      <th className="px-3 py-2 text-right font-medium">Deductions</th>
                      <th className="px-3 py-2 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(run.payslips ?? []).map((payslip) => (
                      <tr key={payslip.id} className="border-t align-top">
                        <td className="px-3 py-2">
                          <p>{nameOf(payslip.profiles)}</p>
                          {payslip.payslip_items?.length ? (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-muted-foreground text-xs">Breakdown</summary>
                              <ul className="mt-1 flex flex-col gap-1">
                                {payslip.payslip_items.map((item) => (
                                  <li key={item.id} className="flex justify-between gap-3 text-xs">
                                    <span>
                                      {item.label} <span className="text-muted-foreground">({item.item_kind})</span>
                                    </span>
                                    <span className="tabular-nums">{money(item.amount_cents)}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(payslip.gross_cents)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(payslip.deductions_cents)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{money(payslip.net_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(run.payroll_approvals ?? []).length > 0 ? (
                <section className="flex flex-col gap-1">
                  <p className="font-medium text-sm">Approval history</p>
                  <ul className="flex flex-col gap-1 text-muted-foreground text-xs">
                    {(run.payroll_approvals ?? []).map((approval) => (
                      <li key={approval.id}>
                        Step {approval.sequence}: {approval.decision} by {nameOf(approval.profiles)}
                        {approval.notes ? ` — ${approval.notes}` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {run.notes ? <p className="text-muted-foreground text-xs">{run.notes}</p> : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {run && canReview && ["draft", "pending_approval"].includes(run.status) ? (
              <>
                <Button type="button" variant="destructive" onClick={() => setPendingReview("rejected")}>
                  Reject
                </Button>
                <Button type="button" onClick={() => setPendingReview("approved")}>
                  Approve
                </Button>
              </>
            ) : null}
            {run && canFinalize && run.status === "approved" ? (
              <Button type="button" onClick={submitFinalize}>
                Finalize
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingReview !== null}
        onOpenChange={(next) => {
          if (!next) setPendingReview(null);
        }}
        action={pendingReview === "rejected" ? "reject" : "approve"}
        description={
          pendingReview === "rejected" ? "The run goes back to draft." : "The run is approved for the next review step."
        }
        onConfirm={() => (pendingReview ? submitReview(pendingReview) : undefined)}
      />
    </>
  );
}
