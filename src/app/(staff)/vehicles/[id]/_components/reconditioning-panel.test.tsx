import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReconditioningPanel } from "./reconditioning-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/(staff)/vehicles/reconditioning-actions", () => ({
  completeReconditioning: vi.fn(),
  markReconditioningRefundReturned: vi.fn(),
  requestReconditioningFunds: vi.fn(),
  startReconditioning: vi.fn(),
  submitReconditioningReport: vi.fn(),
}));

/** A reconditioning job whose only fund request the Head Accountant rejected. */
const job = {
  id: "job-1",
  state: "awaiting_funds",
  status_report: "Brakes and tyres",
  estimated_cost: "2500.50",
  reconditioning_parts: [],
  reconditioning_fund_requests: [
    {
      id: "fund-1",
      amount_cents: 250_050,
      reason: "Initial parts and labor estimate",
      shortfall_reason: null,
      state: "submitted",
      disbursement_requests: { status: "rejected", rejection_reason: "Attach the supplier quotation first" },
    },
  ],
};

describe("ReconditioningPanel rejection reason (BH-4)", () => {
  it("shows the reason on the rejected fund request", () => {
    render(<ReconditioningPanel job={job} userRole="mechanic" />);
    expect(screen.getByText("Rejected: Attach the supplier quotation first")).toBeInTheDocument();
  });

  it("lets the Mechanic send a new report instead of waiting for funds that will not come", () => {
    render(<ReconditioningPanel job={job} userRole="mechanic" />);
    expect(screen.getByRole("button", { name: "Submit report and request funds" })).toBeInTheDocument();
    expect(screen.queryByText("Waiting for the Head Accountant to release funds")).not.toBeInTheDocument();
  });

  it("keeps waiting while a fund request is still open", () => {
    render(
      <ReconditioningPanel
        job={{
          ...job,
          reconditioning_fund_requests: [
            { ...job.reconditioning_fund_requests[0], disbursement_requests: { status: "submitted" } },
          ],
        }}
        userRole="mechanic"
      />,
    );
    expect(screen.getByText("Waiting for the Head Accountant to release funds")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit report and request funds" })).not.toBeInTheDocument();
  });

  it("says nothing about repossession for a bought car", () => {
    render(<ReconditioningPanel job={job} userRole="mechanic" />);
    expect(screen.queryByText(/Repossessed car/)).not.toBeInTheDocument();
  });

  it("shows no rejection line when the request was not rejected", () => {
    render(
      <ReconditioningPanel
        job={{
          ...job,
          reconditioning_fund_requests: [
            { ...job.reconditioning_fund_requests[0], disbursement_requests: { status: "submitted" } },
          ],
        }}
        userRole="mechanic"
      />,
    );
    expect(screen.queryByText(/Rejected:/)).not.toBeInTheDocument();
  });
});
