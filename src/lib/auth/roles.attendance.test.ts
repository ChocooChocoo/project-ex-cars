import { describe, expect, it } from "vitest";

import { ROLE_NAV_ACCESS, STAFF_ROLES } from "./roles";

// T04 E1/E5: every employee clocks in and files leave requests, so every staff role has both links.
describe("attendance and employee requests navigation (T04 E1/E5)", () => {
  it.each(STAFF_ROLES)("%s sees Attendance and Requests", (role) => {
    const access = ROLE_NAV_ACCESS[role];
    if (access === "all") return;
    expect(access.has("attendance")).toBe(true);
    expect(access.has("employee-requests")).toBe(true);
  });
});
