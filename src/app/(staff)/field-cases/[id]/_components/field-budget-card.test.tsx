import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FieldBudgetCard } from "./field-budget-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/(staff)/field-cases/budget-actions", () => ({
  recordBudgetReturn: vi.fn(),
  requestFieldBudget: vi.fn(),
}));

const base = {
  fieldCaseId: "case-1",
  expenses: [],
  isInformant: true,
  open: true,
};

describe("FieldBudgetCard rejection reason (BH-4)", () => {
  it("shows the reason on a rejected request, which is otherwise not the live budget", () => {
    render(
      <FieldBudgetCard
        {...base}
        budget={{ id: "d1", status: "rejected", amount_cents: 200_000, rejection_reason: "File the trip first" }}
      />,
    );
    expect(screen.getByText("Rejected: File the trip first")).toBeInTheDocument();
  });

  it("keeps the request form available so the informant can request again", () => {
    render(
      <FieldBudgetCard
        {...base}
        budget={{ id: "d1", status: "rejected", amount_cents: 200_000, rejection_reason: "File the trip first" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Request budget" })).toBeInTheDocument();
  });

  it("shows no rejection line on a released budget", () => {
    render(<FieldBudgetCard {...base} budget={{ id: "d1", status: "released", amount_cents: 200_000 }} />);
    expect(screen.queryByText(/Rejected:/)).not.toBeInTheDocument();
  });
});
