import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type CompensationRow, PayrollClient, type PayrollRunRow } from "./payroll-client";

const mocks = vi.hoisted(() => ({
  createPayrollRun: vi.fn(),
  finalizePayrollRun: vi.fn(),
  reviewPayrollRun: vi.fn(),
  saveCompensation: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/payroll/actions", () => ({
  createPayrollRun: mocks.createPayrollRun,
  finalizePayrollRun: mocks.finalizePayrollRun,
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
    profiles: { full_name: "Ada Santos" },
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

  it("keeps payroll run workflow actions in the row menu", async () => {
    render(
      <PayrollClient runs={runs} compensation={[]} employees={[]} canPrepare={false} canReview canFinalize={false} />,
    );

    const trigger = screen.getByRole("button", { name: "Open payroll run actions" });
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.mouseUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Approve" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Reject" })).toBeInTheDocument();
  });
});
