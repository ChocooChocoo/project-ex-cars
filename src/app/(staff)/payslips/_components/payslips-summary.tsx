"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

import { PayslipsTable, type PayslipTableRow } from "./payslips-table";

export interface PayrollRunRow {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_gross_cents: number;
  total_net_cents: number;
}

export function getPayrollSummary(runs: PayrollRunRow[]) {
  const total = runs.length;
  const finalized = runs.filter((run) => run.status === "finalized").length;
  const pending = runs.filter((run) => run.status === "pending_approval").length;
  const draft = runs.filter((run) => run.status === "draft").length;
  const totalGross = runs.reduce((sum, run) => sum + (Number(run.total_gross_cents) || 0), 0);
  const totalNet = runs.reduce((sum, run) => sum + (Number(run.total_net_cents) || 0), 0);
  return { total, finalized, pending, draft, totalGross, totalNet };
}

interface PayslipsSummaryProps {
  readonly payrollRuns: PayrollRunRow[];
  readonly ownRows: PayslipTableRow[];
  readonly allRows: PayslipTableRow[];
  readonly userId: string;
}

export function PayslipsSummary({ payrollRuns, ownRows, allRows, userId }: PayslipsSummaryProps) {
  const [showAll, setShowAll] = useState(false);
  const summary = getPayrollSummary(payrollRuns);
  const latestOwn = ownRows[0] ?? null;

  async function handleViewAll() {
    try {
      const supabase = createClient();
      // biome-ignore lint/suspicious/noUnnecessaryConditions: fallback chain needed for audit record_id
      const recordId = payrollRuns[0]?.id ?? allRows[0]?.id ?? ownRows[0]?.id ?? userId;
      await supabase.from("audit_events").insert({
        actor_id: userId,
        action: "payslip_drilldown",
        record_kind: "payslip",
        record_id: recordId,
        summary: `Payslip drilldown by ${userId} to view all payslips`,
      });
    } catch (error) {
      console.error("[payslip_drilldown] audit insert failed", error);
    }
    setShowAll(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div data-testid="payroll-summary-cards" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="flex flex-col gap-1 pt-3">
            <span className="text-muted-foreground text-xs">Payroll Runs</span>
            <span className="font-semibold text-2xl">{summary.total}</span>
            <div className="flex gap-2">
              <Badge variant="secondary">{summary.finalized} finalized</Badge>
              <Badge variant="outline">{summary.pending} pending</Badge>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1 pt-3">
            <span className="text-muted-foreground text-xs">Total Gross</span>
            <span className="font-semibold text-2xl">₱{(summary.totalGross / 100).toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">{summary.draft} draft</span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1 pt-3">
            <span className="text-muted-foreground text-xs">Total Net</span>
            <span className="font-semibold text-2xl">₱{(summary.totalNet / 100).toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">from {summary.total} runs</span>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="own-payslip-card">
        <CardHeader>
          <CardTitle>Your Payslip</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {latestOwn ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">
                  {latestOwn.period_start ? new Date(latestOwn.period_start).toLocaleDateString() : "—"} —{" "}
                  {latestOwn.period_end ? new Date(latestOwn.period_end).toLocaleDateString() : "—"}
                </span>
                <Badge variant={latestOwn.status === "finalized" ? "default" : "secondary"}>{latestOwn.status}</Badge>
                <Badge variant={latestOwn.payment_status === "paid" ? "default" : "outline"}>
                  {latestOwn.payment_status === "paid" ? "Paid" : "Pending"}
                </Badge>
              </div>
              <div className="flex gap-4 text-sm">
                <span>
                  Gross: <span className="font-medium">₱{(latestOwn.gross_cents / 100).toLocaleString()}</span>
                </span>
                <span>
                  Net: <span className="font-medium">₱{(latestOwn.net_cents / 100).toLocaleString()}</span>
                </span>
              </div>
              {ownRows.length > 1 ? (
                <p className="text-muted-foreground text-xs">
                  Showing latest of {ownRows.length} payslip(s) · View all to see history
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No payslip found for your account.</p>
          )}
        </CardContent>
      </Card>

      {!showAll ? (
        <Button data-testid="view-all-payslips" onClick={handleViewAll} variant="outline">
          View all (Finance)
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Payslips</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {allRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">No payslips available.</p>
            ) : (
              <PayslipsTable data={allRows} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
