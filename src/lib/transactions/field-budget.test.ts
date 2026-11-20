import { describe, expect, it } from "vitest";

import {
  budgetExcessCents,
  budgetNoExcess,
  budgetReleased,
  expensesCents,
  FIELD_EXPENSE_CATEGORIES,
  fieldExpenseCategoryLabel,
  fieldExpensePurpose,
} from "./field-budget";

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

describe("field budget categories (BH-5)", () => {
  it("offers the four categories the notes list, in checklist order (line 208)", () => {
    expect(FIELD_EXPENSE_CATEGORIES.map((category) => category.label)).toEqual([
      "Gas",
      "Toll Fee",
      "Parking",
      "Other possible expenses",
    ]);
  });

  it("stores the joined labels in checklist order, whatever order they were ticked", () => {
    expect(fieldExpensePurpose(["parking", "fuel", "tolls"])).toBe("Gas, Toll Fee, Parking");
    expect(fieldExpensePurpose([])).toBe("");
  });

  it("names the other expense when Other is ticked", () => {
    expect(fieldExpensePurpose(["fuel", "other"], " Car wash ")).toBe("Gas, Other: Car wash");
    expect(fieldExpensePurpose(["other"])).toBe("Other possible expenses");
    expect(fieldExpensePurpose(["other"], "   ")).toBe("Other possible expenses");
  });

  it("labels a single stored category", () => {
    expect(fieldExpenseCategoryLabel("parking")).toBe("Parking");
    expect(fieldExpenseCategoryLabel("transport")).toBe("Transportation fare");
    expect(fieldExpenseCategoryLabel(undefined)).toBe("");
  });
});

describe("zero excess (BH-3 / SN-2 / SH-11)", () => {
  it("treats a budget with nothing left as no excess", () => {
    expect(budgetNoExcess(100000, [{ amount: 1000 }])).toBe(true);
    expect(budgetNoExcess(100000, [{ amount: 1200 }])).toBe(true);
  });

  it("still asks for a return when cash is left over", () => {
    expect(budgetNoExcess(100000, [{ amount: 350 }])).toBe(false);
  });

  it("does not call an unreleased budget a zero excess", () => {
    expect(budgetNoExcess(0, [])).toBe(false);
  });
});
