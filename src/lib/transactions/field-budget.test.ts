import { describe, expect, it } from "vitest";

import { budgetExcessCents, budgetReleased, expensesCents } from "./field-budget";

describe("field budget (T10)", () => {
  it("returns the released cash the receipts do not cover", () => {
    expect(expensesCents([{ amount: 1500.5 }, { amount: "250" }])).toBe(175050);
    expect(budgetExcessCents(500000, [{ amount: 1500.5 }, { amount: "250" }])).toBe(324950);
  });

  it("never asks for a negative return", () => {
    expect(budgetExcessCents(100000, [{ amount: 2000 }])).toBe(0);
  });

  it("counts released, received and paid as cash out", () => {
    expect(budgetReleased("released")).toBe(true);
    expect(budgetReleased("paid")).toBe(true);
    expect(budgetReleased("approved")).toBe(false);
  });
});
