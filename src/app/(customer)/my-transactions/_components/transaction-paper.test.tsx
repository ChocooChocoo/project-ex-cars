import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TransactionPaper } from "./transaction-paper";

describe("TransactionPaper balance due", () => {
  it("subtracts the payments received from the total", () => {
    render(
      <TransactionPaper
        reference="ABC12345"
        issuedDate="2026-10-03"
        stateLabel="Completed"
        items={[{ id: "vehicle", description: "Toyota Vios (2025)", quantity: 1, unitPrice: 500000 }]}
        total={500000}
        paid={500000}
        from={{ name: "GCE Auto", email: "", website: "", addressLines: [], issuerName: "" }}
        billTo={{ name: "Customer", email: "", addressLines: [] }}
      />,
    );

    expect(screen.getByText("Payments received").nextElementSibling).toHaveTextContent("500,000.00");
    expect(screen.getByText("Balance due").nextElementSibling).toHaveTextContent(/[^\d,]0\.00/);
  });

  it("shows nothing due on a cancelled or rejected transaction", () => {
    render(
      <TransactionPaper
        reference="ABC12345"
        issuedDate="2026-10-03"
        stateLabel="Cancelled"
        items={[{ id: "vehicle", description: "Toyota Vios (2025)", quantity: 1, unitPrice: 500000 }]}
        total={500000}
        closed
        from={{ name: "GCE Auto", email: "", website: "", addressLines: [], issuerName: "" }}
        billTo={{ name: "Customer", email: "", addressLines: [] }}
      />,
    );

    expect(screen.getByText("Balance due").nextElementSibling).toHaveTextContent(/[^\d,]0\.00/);
  });
});
