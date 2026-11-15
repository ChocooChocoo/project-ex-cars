import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { FieldExpensesCard } from "./field-expenses-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/field-cases/sell-inspection-actions", () => ({ fileFieldExpense: vi.fn() }));

const expense = {
  id: "expense-1",
  amount: 350,
  description: "Fuel and toll",
  submitted_by: "ci-1",
  submitted_at: "2026-11-01T02:00:00.000Z",
  reimbursed_at: null,
};

it("shows the receipt photo beside the expense when the proof is on record", () => {
  const { rerender } = render(
    <FieldExpensesCard
      fieldCaseId="case-1"
      expenses={[{ ...expense, proof_url: "https://example.test/receipt.png" }]}
      canFile={false}
    />,
  );

  expect(screen.getByText("Fuel and toll · ₱350.00")).toBeInTheDocument();
  expect(screen.getByLabelText("Open Receipt for Fuel and toll in a larger view")).toBeInTheDocument();

  rerender(<FieldExpensesCard fieldCaseId="case-1" expenses={[{ ...expense, proof_url: null }]} canFile={false} />);
  expect(screen.queryByLabelText("Open Receipt for Fuel and toll in a larger view")).not.toBeInTheDocument();
  expect(screen.getByText("Fuel and toll · ₱350.00")).toBeInTheDocument();
});

it("says so when nothing was filed yet", () => {
  render(<FieldExpensesCard fieldCaseId="case-1" expenses={[]} canFile={false} />);
  expect(screen.getByText("No expenses filed yet.")).toBeInTheDocument();
});
