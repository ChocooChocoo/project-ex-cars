import { describe, expect, it } from "vitest";

import { manilaDay, reminderDueDates, reminderMessage } from "./reminders";

describe("T06 payment reminders", () => {
  it("uses the Manila date, not UTC", () => {
    // 20:00 UTC on Nov 4 is already Nov 5 in Manila.
    expect(manilaDay(new Date("2026-11-04T20:00:00Z"))).toBe("2026-11-05");
  });

  it("picks the installments due in 7, 3 and 1 days", () => {
    const dates = reminderDueDates(new Date("2026-11-04T01:00:00Z"));
    expect([...dates]).toEqual([
      ["2026-11-11", 7],
      ["2026-11-07", 3],
      ["2026-11-05", 1],
    ]);
  });

  it("says when and how much", () => {
    const message = reminderMessage({
      name: "Maria",
      amount: 33334,
      dueDate: "2026-11-05",
      days: 1,
      car: "2022 Toyota Vios",
    });
    expect(message.subject).toBe("GCE payment reminder: ₱33,334.00 due tomorrow");
    expect(message.text).toContain("2022 Toyota Vios is due tomorrow, on 2026-11-05");
  });
});
