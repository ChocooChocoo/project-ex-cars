import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type CompensationRow, PayrollClient, type PayrollRunRow } from "./payroll-client";

const mocks = vi.hoisted(() => ({
  createPayrollRun: vi.fn(),
  finalizePayrollRun: vi.fn(),
  getPayrollRunDetail: vi.fn(),
  reviewPayrollRun: vi.fn(),
  saveCompensation: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/payroll/actions", () => ({
  createPayrollRun: mocks.createPayrollRun,
  finalizePayrollRun: mocks.finalizePayrollRun,
  getPayrollRunDetail: mocks.getPayrollRunDetail,
  reviewPayrollRun: mocks.reviewPayrollRun,
  saveCompensation: mocks.saveCompensation,
}));

const compensation: CompensationRow[] = [
  {
    id: "comp-1",
    employee_id: "employee-1",
    base_salary_cents: 500000,
    effective_from: "2026-08-01",
    effective_until: null,
    full_name: "Ada Santos",
  },
];

const runs: PayrollRunRow[] = [
  {
    id: "run-1",
    period_start: "2026-08-01",
    period_end: "2026-08-15",
    status: "pending_approval",
    total_gross_cents: 500000,
    total_deductions_cents: 50000,
    total_net_cents: 450000,
    notes: null,
  },
];

describe("PayrollClient template tables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPayrollRun.mockResolvedValue({ success: true });
    mocks.finalizePayrollRun.mockResolvedValue({ success: true });
    mocks.reviewPayrollRun.mockResolvedValue({ success: true });
    mocks.saveCompensation.mockResolvedValue({ success: true });
    mocks.getPayrollRunDetail.mockResolvedValue({
      success: true,
      run: {
        ...runs[0],
        payslips: [
          {
            id: "payslip-1",
            employee_id: "employee-1",
            gross_cents: 500000,
            deductions_cents: 50000,
            net_cents: 450000,
            status: "draft",
            profiles: { full_name: "Ada Santos" },
            payslip_items: [],
          },
        ],
        payroll_approvals: [],
      },
    });
  });

  it("renders both payroll tables with template search, filters, selection, and pagination", () => {
    render(<PayrollClient runs={runs} compensation={compensation} employees={[]} canPrepare canReview canFinalize />);

    expect(screen.getByPlaceholderText("Search compensation...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search payroll runs...")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Status" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Sort" })).toHaveLength(2);
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(document.getElementById("payroll-compensation-rows-per-page")).toBeInTheDocument();
    expect(document.getElementById("payroll-runs-rows-per-page")).toBeInTheDocument();
  });

  it("opens the run detail before any approval action", async () => {
    render(<PayrollClient runs={runs} compensation={[]} employees={[]} canPrepare={false} canReview canFinalize />);

    fireEvent.click(screen.getByRole("button", { name: "View payroll run details" }));

    expect(await screen.findByText("Ada Santos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("approves a payroll run once and hides Approve afterwards", async () => {
    let resolveReview: ((value: unknown) => void) | undefined;
    mocks.reviewPayrollRun.mockReturnValue(
      new Promise((resolve) => {
        resolveReview = resolve;
      }),
    );
    mocks.getPayrollRunDetail
      .mockResolvedValueOnce({
        success: true,
        run: { ...runs[0], payslips: [], payroll_approvals: [] },
      })
      .mockResolvedValue({
        success: true,
        run: {
          ...runs[0],
          status: "pending_approval",
          payslips: [],
          payroll_approvals: [{ id: "a1", sequence: 1, decision: "approved", notes: null }],
        },
      });

    render(<PayrollClient runs={runs} compensation={[]} employees={[]} canPrepare={false} canReview canFinalize />);

    fireEvent.click(screen.getByRole("button", { name: "View payroll run details" }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));

    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    expect(within(dialog).getByRole("button", { name: "Saving..." })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Saving..." }));

    resolveReview?.({ success: true });

    await waitFor(() => expect(mocks.reviewPayrollRun).toHaveBeenCalledTimes(1));
    // T07 CR1: the view closes, and the Head Accountant's own step is already approved.
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "View payroll run details" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument());
  });
});
