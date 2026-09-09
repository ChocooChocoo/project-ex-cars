import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getPayrollSummary, type PayrollRunRow, PayslipsSummary } from "./payslips-summary";
import type { PayslipTableRow } from "./payslips-table";

const insertMock = vi.fn(() => Promise.resolve({ error: null }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: insertMock,
    }),
  }),
}));

function run(overrides: Partial<PayrollRunRow> = {}): PayrollRunRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    period_start: "2026-07-01",
    period_end: "2026-07-15",
    status: "finalized",
    total_gross_cents: 100000,
    total_net_cents: 80000,
    ...overrides,
  };
}

function payslip(overrides: Partial<PayslipTableRow> = {}): PayslipTableRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    period_start: "2026-07-01",
    period_end: "2026-07-15",
    gross_cents: 50000,
    net_cents: 45000,
    status: "finalized",
    payment_status: "pending",
    ...overrides,
  };
}

describe("getPayrollSummary", () => {
  it("derives totals from same payroll_runs array without second fetch", () => {
    const runs = [
      run({ id: "1", status: "finalized", total_gross_cents: 100000, total_net_cents: 90000 }),
      run({ id: "2", status: "draft", total_gross_cents: 50000, total_net_cents: 40000 }),
      run({ id: "3", status: "pending_approval", total_gross_cents: 20000, total_net_cents: 18000 }),
    ];
    const summary = getPayrollSummary(runs);
    expect(summary.total).toBe(3);
    expect(summary.finalized).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.draft).toBe(1);
    expect(summary.totalGross).toBe(170000);
    expect(summary.totalNet).toBe(148000);
  });
});

describe("PayslipsSummary", () => {
  it("renders summary cards and own payslip, hides full table behind View all", () => {
    render(
      <PayslipsSummary
        payrollRuns={[run()]}
        ownRows={[payslip()]}
        allRows={[payslip(), payslip({ id: "33333333-3333-4333-8333-333333333333" })]}
        userId="99999999-9999-4999-8999-999999999999"
      />,
    );
    expect(screen.getByTestId("payroll-summary-cards")).toBeInTheDocument();
    expect(screen.getByTestId("own-payslip-card")).toBeInTheDocument();
    expect(screen.getByText(/Your Payslip/)).toBeInTheDocument();
    expect(screen.getByTestId("view-all-payslips")).toBeInTheDocument();
    expect(screen.queryByText("All Payslips")).not.toBeInTheDocument();
  });

  it("View all inserts audit_events and then shows PayslipsTable", async () => {
    insertMock.mockClear();
    render(
      <PayslipsSummary
        payrollRuns={[run()]}
        ownRows={[payslip()]}
        allRows={[payslip(), payslip({ id: "44444444-4444-4444-8444-444444444444", gross_cents: 60000 })]}
        userId="99999999-9999-4999-8999-999999999999"
      />,
    );
    const button = screen.getByTestId("view-all-payslips");
    fireEvent.click(button);
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "99999999-9999-4999-8999-999999999999",
        action: "payslip_drilldown",
        record_kind: "payslip",
      }),
    );
    expect(await screen.findByText("All Payslips")).toBeInTheDocument();
  });

  it("still shows table when audit insert fails (non-blocking)", async () => {
    insertMock.mockImplementationOnce(() => Promise.reject(new Error("audit failed")));
    render(
      <PayslipsSummary
        payrollRuns={[run()]}
        ownRows={[payslip()]}
        allRows={[payslip()]}
        userId="99999999-9999-4999-8999-999999999999"
      />,
    );
    fireEvent.click(screen.getByTestId("view-all-payslips"));
    expect(await screen.findByText("All Payslips")).toBeInTheDocument();
  });

  it("shows fallback when no own payslip", () => {
    render(
      <PayslipsSummary payrollRuns={[run()]} ownRows={[]} allRows={[]} userId="99999999-9999-4999-8999-999999999999" />,
    );
    expect(screen.getByText(/No payslip found/)).toBeInTheDocument();
  });
});
