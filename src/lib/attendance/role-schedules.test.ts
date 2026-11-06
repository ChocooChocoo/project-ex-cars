import { describe, expect, it } from "vitest";

import { ROLE_WORK_SCHEDULES } from "./role-schedules";

describe("T05 role work schedules", () => {
  it.each([
    ["head_accountant", "09:00", "18:00"],
    ["sales_manager", "08:00", "17:00"],
    ["account_manager", "08:00", "17:00"],
    ["marketing_specialist", "08:00", "17:00"],
    ["confidential_informant", "07:00", "16:00"],
    ["mechanic", "07:00", "16:00"],
  ])("assigns %s its Mon-Sat schedule", (role, start, end) => {
    expect(ROLE_WORK_SCHEDULES[role]).toEqual({
      workdays: [1, 2, 3, 4, 5, 6],
      start_time: start,
      end_time: end,
      grace_minutes: 10,
      timezone: "Asia/Manila",
    });
  });

  it("does not invent schedules for unspecified roles", () => {
    expect(Object.keys(ROLE_WORK_SCHEDULES)).toHaveLength(6);
    for (const role of ["ceo", "head_security", "customer"]) {
      expect(ROLE_WORK_SCHEDULES[role]).toBeUndefined();
    }
  });
});
