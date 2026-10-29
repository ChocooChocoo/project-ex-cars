import { describe, expect, it } from "vitest";

import { ROLE_NAV_ACCESS, STAFF_ROLES } from "./roles";

describe("attendance and employee requests navigation (T04 E1/E5)", () => {
  it.each(STAFF_ROLES.filter((role) => role !== "head_security"))("%s sees Attendance and Requests", (role) => {
    const access = ROLE_NAV_ACCESS[role];
    if (access === "all") return;
    expect(access.has("attendance")).toBe(true);
    expect(access.has("employee-requests")).toBe(true);
  });

  it("exempts Head Security from Attendance but preserves unrelated staff links", () => {
    const access = ROLE_NAV_ACCESS.head_security;
    expect(access).not.toBe("all");
    if (access === "all") return;
    expect(access.has("attendance")).toBe(false);
    for (const item of ["employee-requests", "field-cases", "security-duty-checks"]) {
      expect(access.has(item)).toBe(true);
    }
  });
});
