import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(staff)/transactions/actions", () => ({ instructRepossession: vi.fn() }));

import { FinancingMonitor } from "./financing-monitor";

const account = {
  id: "a1",
  purchase_transaction_id: "t1",
  financed_total: 600000,
  transactions: {
    profiles: { full_name: "Fina Buyer" },
    vehicles: { year: 2022, make: "Mitsubishi", model: "Mirage G4" },
  },
  installments: [{ state: "paid", due_date: "2026-12-10" }],
};
const cash = {
  id: "t2",
  completed_at: "2026-11-01T00:00:00Z",
  profiles: { full_name: "Cash Buyer" },
  vehicles: { year: 2020, make: "Toyota", model: "Vios" },
  purchase_details: { payment_method: "cash", final_price: 500000 },
};

describe("Sold Inventory (T10)", () => {
  it("lists cars sold in cash and on financing, filtered by payment type", () => {
    render(<FinancingMonitor accounts={[account]} cashSales={[cash]} workers={[]} cases={[]} canRequest={false} />);
    expect(screen.getByRole("heading", { name: "Sold Inventory" })).toBeInTheDocument();
    expect(screen.getByText("Fina Buyer")).toBeInTheDocument();
    expect(screen.getByText("Cash Buyer")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Cash" }));
    expect(screen.queryByText("Fina Buyer")).toBeNull();
    expect(screen.getByText("Cash Buyer")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Financing" }));
    expect(screen.getByText("Fina Buyer")).toBeInTheDocument();
    expect(screen.queryByText("Cash Buyer")).toBeNull();
  });
});
