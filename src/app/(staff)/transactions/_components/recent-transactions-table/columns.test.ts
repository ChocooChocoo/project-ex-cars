import { describe, expect, it } from "vitest";

import { transactionActionsFor } from "./columns";
import type { TransactionRow } from "./schema";

function row(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    customerName: "Buyer One",
    customerEmail: "",
    kind: "buy",
    state: "pending",
    paymentMethod: "cash",
    vehicleMake: "Toyota",
    vehicleModel: "Vios",
    vehicleYear: "2024",
    openedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("transactionActionsFor (T05)", () => {
  it("drops Cancel for the Sales Manager on a CASH buy, before and after approval", () => {
    expect(transactionActionsFor(row(), "sales_manager")).toEqual(["under_review"]);
    expect(transactionActionsFor(row({ state: "approved" }), "sales_manager")).toEqual(["completed"]);
    expect(transactionActionsFor(row({ paymentMethod: "bank_transfer" }), "sales_manager")).toEqual(["under_review"]);
  });

  it("removes Cancel on a financing buy", () => {
    expect(transactionActionsFor(row({ state: "approved", paymentMethod: "financing" }), "sales_manager")).toEqual([
      "completed",
    ]);
  });

  it("T10: gives the CEO no Approve or Cancel in the row menu", () => {
    expect(transactionActionsFor(row(), "ceo")).toEqual(["under_review"]);
    expect(transactionActionsFor(row({ state: "under_review" }), "ceo")).not.toContain("approved");
  });

  it("T10: offers only View on a sell offer", () => {
    expect(transactionActionsFor(row({ kind: "sell" }), "ceo")).toEqual([]);
    expect(transactionActionsFor(row({ kind: "sell" }), "sales_manager")).toEqual([]);
  });
});
