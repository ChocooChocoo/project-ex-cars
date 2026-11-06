import { describe, expect, it } from "vitest";

import { consecutiveMissedPayments } from "./recovery";

describe("consecutive missed payments", () => {
  const today = new Date("2026-11-06T12:00:00Z");
  it("requires four consecutive past-due payments, not four scattered misses", () => {
    const rows = ["pending", "pending", "paid", "pending", "pending"].map((state, index) => ({
      state,
      due_date: `2026-0${index + 1}-01`,
    }));
    expect(consecutiveMissedPayments(rows, today)).toBe(2);
    expect(
      consecutiveMissedPayments(
        rows.map((row) => ({ ...row, state: "pending" })),
        today,
      ),
    ).toBe(5);
  });
  it("ignores future payments and stops at paid or waived", () => {
    expect(
      consecutiveMissedPayments(
        [
          { state: "pending", due_date: "2026-12-01" },
          { state: "waived", due_date: "2026-10-01" },
        ],
        today,
      ),
    ).toBe(0);
  });
});
