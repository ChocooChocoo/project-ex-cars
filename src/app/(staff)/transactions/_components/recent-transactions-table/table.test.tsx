import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(staff)/transactions/actions", () => ({ transitionTransaction: vi.fn() }));

import { RecentTransactionsTable } from "./table";

it("hides the kind filter from Sales Manager", () => {
  render(<RecentTransactionsTable data={[]} userRole="sales_manager" />);
  expect(screen.queryByRole("button", { name: "Billing" })).not.toBeInTheDocument();
});

it("keeps the kind filter for CEO", () => {
  render(<RecentTransactionsTable data={[]} userRole="ceo" />);
  expect(screen.getByRole("button", { name: "Billing" })).toBeInTheDocument();
});

it("shows paid installment count on the Sales Manager list", () => {
  render(
    <RecentTransactionsTable
      data={[
        {
          id: "tx-1",
          customerName: "Buyer",
          customerEmail: "",
          kind: "buy",
          state: "approved",
          paymentMethod: "financing",
          vehicleMake: "Toyota",
          vehicleModel: "Vios",
          vehicleYear: "2024",
          openedAt: "2026-11-01T00:00:00Z",
          paidInstallments: 2,
          totalInstallments: 12,
        },
      ]}
      userRole="sales_manager"
    />,
  );
  expect(screen.getByText("Paid 2 of 12")).toBeInTheDocument();
});
