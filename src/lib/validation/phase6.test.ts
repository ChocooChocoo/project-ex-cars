import { describe, expect, it } from "vitest";

import { employeeRequestSchema, LEAVE_REASONS } from "./phase6";

const levelOne = (input: Record<string, unknown>) => {
  const result = employeeRequestSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

const leave = (extra: Record<string, unknown> = {}) => ({
  request_kind: "leave",
  start_date: "2026-11-02",
  end_date: "2026-11-03",
  leave_reason: "sick",
  ...extra,
});

describe("LEAVE_REASONS", () => {
  it("lists the six agreed leave reasons", () => {
    expect(LEAVE_REASONS).toEqual(["sick", "vacation", "emergency", "bereavement", "maternity_paternity", "others"]);
  });
});

describe("employeeRequestSchema leave branch", () => {
  it.each(LEAVE_REASONS.filter((reason) => reason !== "others"))("accepts %s without a typed reason", (leaveReason) => {
    expect(employeeRequestSchema.safeParse(leave({ leave_reason: leaveReason })).success).toBe(true);
  });

  it("refuses a leave request without a leave reason", () => {
    expect(levelOne(leave({ leave_reason: undefined }))).toBe("Choose a leave reason.");
  });

  it("refuses a leave reason outside the dropdown", () => {
    expect(levelOne(leave({ leave_reason: "vacationing" }))).toBe("Choose a leave reason.");
  });

  it("refuses Others without typed text", () => {
    expect(levelOne(leave({ leave_reason: "others", reason: "   " }))).toBe("Describe the reason for the leave.");
    expect(
      employeeRequestSchema.safeParse(leave({ leave_reason: "others", reason: "Hospital transfer" })).success,
    ).toBe(true);
  });

  it("still refuses an end date before the start date", () => {
    expect(levelOne(leave({ end_date: "2026-11-01" }))).toBe("End date must be on or after the start date.");
  });
});

describe("employeeRequestSchema overtime branch", () => {
  const overtime = (extra: Record<string, unknown> = {}) => ({
    request_kind: "overtime",
    start_date: "2026-11-02",
    overtime_hours: "2",
    ...extra,
  });

  it("accepts a date and the approved hours", () => {
    const parsed = employeeRequestSchema.safeParse(overtime());

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({
      request_kind: "overtime",
      start_date: "2026-11-02",
      overtime_hours: 2,
    });
  });

  it("accepts the 0.5 and 12 hour limits", () => {
    expect(employeeRequestSchema.safeParse(overtime({ overtime_hours: "0.5" })).success).toBe(true);
    expect(employeeRequestSchema.safeParse(overtime({ overtime_hours: "12" })).success).toBe(true);
  });

  it("refuses a missing date", () => {
    expect(levelOne(overtime({ start_date: "" }))).toBe("Date is required.");
  });

  it("refuses missing hours and hours outside the limit", () => {
    expect(levelOne(overtime({ overtime_hours: undefined }))).toBe("Enter the overtime hours.");
    expect(levelOne(overtime({ overtime_hours: "0.4" }))).toBe("Enter at least 0.5 hours.");
    expect(levelOne(overtime({ overtime_hours: "12.5" }))).toBe("Enter at most 12 hours.");
  });

  it("drops an end date and a reason instead of saving them", () => {
    const parsed = employeeRequestSchema.safeParse(overtime({ end_date: "2026-11-03", reason: "Month-end closing" }));

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).not.toHaveProperty("end_date");
    expect(parsed.success && parsed.data).not.toHaveProperty("reason");
  });
});

describe("employeeRequestSchema other branches", () => {
  it.each(["schedule_change", "other"] as const)("keeps the required reason for %s", (requestKind) => {
    expect(levelOne({ request_kind: requestKind, start_date: "2026-11-02", reason: "" })).toBe("Reason is required.");
  });

  it("does not accept a leave reason on a non-leave request", () => {
    const parsed = employeeRequestSchema.safeParse({
      request_kind: "schedule_change",
      start_date: "2026-11-02",
      reason: "Month-end closing",
      leave_reason: "sick",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).not.toHaveProperty("leave_reason");
  });

  it("refuses an unknown request kind", () => {
    expect(employeeRequestSchema.safeParse({ request_kind: "vacation", start_date: "2026-11-02" }).success).toBe(false);
  });
});
