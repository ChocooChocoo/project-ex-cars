import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { missedPaymentPolicy, paperFinancing, paperSale } from "@/lib/papers/templates";

import { PaperDocumentView } from "./paper-document-view";

const row = {
  opened_at: "2026-10-31T02:00:00.000Z",
  completed_at: null,
  purchase_details: { final_price: 500000 },
  profiles: { full_name: "Maria Santos", address: "12 Mabini St, Batangas City" },
  vehicles: { make: "Toyota", model: "Vios", year: 2022, exterior_color: "Pearl White" },
  payment_terms: {
    total_amount: 500000,
    down_payment: 50000,
    duration_months: 24,
    monthly_payment: 18750,
    first_due_date: "2026-12-01",
  },
  installment_accounts: { opening_balance: 450000 },
};

it("prints the filled policy with a working browser Print action", () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  render(
    <PaperDocumentView
      paper={missedPaymentPolicy(paperSale(row), paperFinancing(row))}
      heading="Missed payment policy"
      note="Print this policy for the client at delivery."
      backHref="/dashboard/transactions/tx"
      backLabel="Transaction"
    />,
  );
  expect(screen.getByRole("link", { name: "Transaction" })).toHaveAttribute("href", "/dashboard/transactions/tx");
  const printRoot = document.querySelector<HTMLElement>("[data-print-root]");
  expect(printRoot).not.toBeNull();
  expect(
    within(printRoot as HTMLElement).getByText(/Four \(4\) consecutive missed monthly payments/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Print" }));
  expect(print).toHaveBeenCalledOnce();
  print.mockRestore();
});
