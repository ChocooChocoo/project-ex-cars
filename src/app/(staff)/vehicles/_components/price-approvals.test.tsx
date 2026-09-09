import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PendingApprovalsTable, type PriceProposalRow } from "./price-approvals";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(staff)/vehicles/actions", () => ({ approvePrice: vi.fn(() => Promise.resolve({ success: true })) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function proposal(overrides: Partial<PriceProposalRow> = {}): PriceProposalRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    vehicle_id: "22222222-2222-4222-8222-222222222222",
    proposed_amount: 500000,
    notes: "Test proposal",
    created_at: new Date().toISOString(),
    vehicles: { make: "Toyota", model: "Camry", year: 2022 },
    ...overrides,
  };
}

describe("PendingApprovalsTable canApprove", () => {
  it("shows Approve and Reject when canApprove true (default ceo)", async () => {
    render(<PendingApprovalsTable proposals={[proposal()]} canApprove />);
    const trigger = screen.getByRole("button", { name: /Open actions for/ });
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.mouseUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    expect(await screen.findByRole("menuitem", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Reject" })).toBeInTheDocument();
  });

  it("head_accountant sees pending but no Approve when canApprove false", async () => {
    render(<PendingApprovalsTable proposals={[proposal()]} canApprove={false} />);
    const trigger = screen.getByRole("button", { name: /Open actions for/ });
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.mouseUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    // menu is present, but Approve/Reject hidden
    expect(menu).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "View Details" })).toBeInTheDocument();
  });

  it("renders pending count badge read-only", () => {
    render(
      <PendingApprovalsTable
        proposals={[proposal(), proposal({ id: "33333333-3333-4333-8333-333333333333" })]}
        canApprove={false}
      />,
    );
    expect(screen.getByText("2 pending")).toBeInTheDocument();
  });
});
