import { describe, expect, it } from "vitest";

import { ATTENDANCE_TRACKED_ROLES } from "@/lib/auth/roles";

// Phase 7: the page guards with useRequireRole(ATTENDANCE_TRACKED_ROLES); Laravel refuses Head Security on every
// attendance endpoint (backend/tests/Feature/Staff/AttendanceTest.php).
describe("Attendance route eligibility", () => {
  it("leaves Head Security out of the attendance roles", () => {
    expect(ATTENDANCE_TRACKED_ROLES).not.toContain("head_security");
    expect(ATTENDANCE_TRACKED_ROLES).toEqual(expect.arrayContaining(["ceo", "account_manager", "mechanic"]));
  });
});
