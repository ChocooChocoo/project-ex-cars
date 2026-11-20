import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PurchaseFundsCard } from "@/components/transactions/purchase-funds-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/(staff)/field-cases/budget-actions", () => ({ recordBudgetReturn: vi.fn() }));
vi.mock("@/app/(staff)/finance/actions", () => ({ recordSellerPaid: vi.fn(), requestPurchaseFunds: vi.fn() }));

const base = {
  transactionId: "tx-1",
  fieldCaseId: "case-1",
  agreedPrice: 450000,
  halfway: true,
  expenses: [],
  canRequest: false,
  isRequester: true,
  cleared: false,
};

describe("PurchaseFundsCard rejection reason (BH-4)", () => {
  it("shows the reason the Head Accountant rejected the request", () => {
    render(
      <PurchaseFundsCard
        {...base}
        fund={{
          id: "d1",
          status: "rejected",
          amount_cents: 45_000_000,
          rejection_reason: "Pay the seller at the meet-up",
        }}
      />,
    );
    expect(screen.getByText("Rejected: Pay the seller at the meet-up")).toBeInTheDocument();
  });

  it("shows nothing extra when there is no rejection", () => {
    render(<PurchaseFundsCard {...base} fund={{ id: "d1", status: "submitted", amount_cents: 45_000_000 }} />);
    expect(screen.queryByText(/Rejected:/)).not.toBeInTheDocument();
  });
});

describe("PurchaseFundsCard excess return choice (notes lines 209-213)", () => {
  it("preselects 'Budget was exact' with no cash input when nothing is left", () => {
    render(<PurchaseFundsCard {...base} fund={{ id: "d1", status: "paid", amount_cents: 45_000_000 }} />);
    expect(screen.getByRole("radio", { name: "Budget was exact for the trip" })).toBeChecked();
    expect(screen.queryByLabelText("Cash returned (₱)")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record Excess Return" })).toBeEnabled();
  });

  it("preselects 'Excess budget to return' and asks for the cash when there is an excess", () => {
    render(<PurchaseFundsCard {...base} fund={{ id: "d1", status: "paid", amount_cents: 45_500_000 }} />);
    expect(screen.getByRole("radio", { name: "Excess budget to return" })).toBeChecked();
    expect(screen.getByLabelText("Cash returned (₱)")).toBeInTheDocument();
  });
});
