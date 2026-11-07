import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(staff)/transactions/financing-actions", () => ({
  completeFinancingAgreement: vi.fn(),
  confirmFinancingTerms: vi.fn(),
  proposeFinancingTerms: vi.fn(),
  recordVehicleRecovered: vi.fn(),
  recordVisitDecision: vi.fn(),
  reviewFinancingTerms: vi.fn(),
}));

import { MISSED_PAYMENT_POLICY } from "@/lib/transactions/missed-payment-policy";

import { FinancingPanel } from "./financing-panel";

const props = {
  transactionId: "tx",
  state: "approved",
  flowStatus: null,
  terms: null,
  account: null,
  hasRecoveryCase: false,
  recoveryInProgress: false,
  userRole: "sales_manager",
  defaultTotal: 500000,
  vehiclePrice: 400000,
  requestedTermMonths: 12,
};

it("shows fixed policy without an editable field and allows complete terms to be sent", () => {
  render(<FinancingPanel {...props} />);
  expect(screen.getByText(MISSED_PAYMENT_POLICY)).toBeInTheDocument();
  expect(screen.queryByLabelText("Missed payment policy")).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("First installment due"), { target: { value: "2033-12-01" } });
  expect(screen.getByRole("button", { name: "Send to Head Accountant" })).toBeEnabled();
});

it.each(["head_accountant", "ceo"])("links %s to the printable policy instead of stored custom text", (userRole) => {
  render(
    <FinancingPanel
      {...props}
      userRole={userRole}
      terms={{ state: "approved", missed_payment_policy: "Obsolete custom policy" }}
    />,
  );
  expect(screen.queryByText("Obsolete custom policy")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Print missed payment policy" })).toHaveAttribute(
    "href",
    "/vehicle-papers/tx/missed-payment-policy",
  );
});

it.each([
  "head_accountant",
  "sales_manager",
])("shows the same paid count for %s, excluding pending and waived", (userRole) => {
  render(
    <FinancingPanel
      {...props}
      userRole={userRole}
      account={{
        state: "active",
        installments: [
          { state: "paid", due_date: "2026-10-15", amount_due: 1000 },
          { state: "due", due_date: "2026-11-15", amount_due: 1000 },
          { state: "waived", due_date: "2026-12-15", amount_due: 1000 },
        ],
      }}
    />,
  );
  expect(screen.getByText("Paid 1 of 3")).toBeInTheDocument();
});
