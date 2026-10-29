import { describe, expect, it } from "vitest";

import { formatSchedule, isMissingSchedule, isStaffAccount } from "./columns";
import type { StaffTableRow } from "./schema";

const account: StaffTableRow = {
  id: "staff-1",
  fullName: "Test Staff",
  role: "head_security",
  accountState: "active",
  joined: "2026-10-29T00:00:00Z",
  schedule: null,
  phone: null,
  address: null,
  workdays: null,
  startTime: null,
  endTime: null,
  graceMinutes: null,
};

describe("Staff Records attendance exemption", () => {
  it("keeps Head Security as staff without flagging a missing schedule", () => {
    expect(isStaffAccount(account)).toBe(true);
    expect(isMissingSchedule(account)).toBe(false);
  });

  it("explains the exemption even if a historical schedule exists", () => {
    expect(formatSchedule(account)).toBe("Attendance not required");
    expect(formatSchedule({ ...account, workdays: [1], startTime: "08:00", endTime: "17:00" })).toBe(
      "Attendance not required",
    );
  });

  it.each(["ceo", "mechanic", "account_manager"])("still flags an unscheduled %s", (role) => {
    expect(isMissingSchedule({ ...account, role })).toBe(true);
  });

  it.each(["customer", "supplier", null])("does not treat %s as an employee needing a schedule", (role) => {
    expect(isMissingSchedule({ ...account, role })).toBe(false);
  });
});
