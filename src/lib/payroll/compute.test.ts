import { describe, expect, it } from "vitest";

import { computePayslip, scheduledHours } from "./compute";

// ₱27,000 a month / 30 days / 9 h a day = ₱100.00 an hour.
const base = { baseSalaryCents: 2_700_000, scheduledHoursPerDay: 9, overtimeRanges: [] };
const day = (attendance_date: string, hours_worked: number | null) => ({ attendance_date, hours_worked });

describe("computePayslip", () => {
  it("pays a full regular day with no late line", () => {
    const result = computePayslip({ ...base, entries: [day("2026-10-01", 9)] });

    expect(result).toEqual({
      hourlyRateCents: 10_000,
      regularHours: 9,
      overtimeHours: 0,
      shortMinutes: 0,
      regularCents: 90_000,
      overtimeCents: 0,
      lateCents: 0,
    });
  });

  it("deducts the missing hours of a half day as undertime", () => {
    const result = computePayslip({ ...base, entries: [day("2026-10-01", 4)] });

    expect(result).toMatchObject({ regularHours: 9, shortMinutes: 300, regularCents: 90_000, lateCents: 50_000 });
  });

  it("charges a late arrival once, through the time short of schedule", () => {
    // In 08:20, out 17:00: 8 h 40 min worked.
    const result = computePayslip({ ...base, entries: [day("2026-10-01", 8.67)] });

    expect(result.shortMinutes).toBe(20);
    expect(result.lateCents).toBe(3_333);
    expect(result.regularCents - result.lateCents).toBe(86_667);
  });

  it("pays overtime at 125% on a day with an approved overtime request", () => {
    const result = computePayslip({
      ...base,
      entries: [day("2026-10-01", 11), day("2026-10-02", 10)],
      overtimeRanges: [{ start_date: "2026-10-01", end_date: null, overtime_hours: null }],
    });

    expect(result).toMatchObject({ overtimeHours: 2, overtimeCents: 25_000, shortMinutes: 0 });
  });

  it("covers every day of a multi-day overtime request", () => {
    const result = computePayslip({
      ...base,
      entries: [day("2026-10-01", 10), day("2026-10-02", 10), day("2026-10-04", 10)],
      overtimeRanges: [{ start_date: "2026-10-01", end_date: "2026-10-03", overtime_hours: null }],
    });

    expect(result.overtimeHours).toBe(2);
  });

  it("caps overtime at the approved hours when more were worked", () => {
    // 4 h past the 9 h schedule, but only 2 h were approved.
    const result = computePayslip({
      ...base,
      entries: [day("2026-10-01", 13)],
      overtimeRanges: [{ start_date: "2026-10-01", end_date: null, overtime_hours: 2 }],
    });

    expect(result).toMatchObject({ overtimeHours: 2, overtimeCents: 25_000, shortMinutes: 0 });
  });

  it("pays only the hours worked when they are under the approved hours", () => {
    const result = computePayslip({
      ...base,
      entries: [day("2026-10-01", 10)],
      overtimeRanges: [{ start_date: "2026-10-01", end_date: null, overtime_hours: 3 }],
    });

    expect(result).toMatchObject({ overtimeHours: 1, overtimeCents: 12_500, shortMinutes: 0 });
  });

  it("keeps the uncapped rule for a legacy request with null approved hours", () => {
    const result = computePayslip({
      ...base,
      entries: [day("2026-10-01", 13)],
      overtimeRanges: [{ start_date: "2026-10-01", end_date: null, overtime_hours: null }],
    });

    expect(result).toMatchObject({ overtimeHours: 4, overtimeCents: 50_000 });
  });

  it("pays no overtime for extra hours without an approved request", () => {
    const result = computePayslip({ ...base, entries: [day("2026-10-01", 11)] });

    expect(result).toMatchObject({ overtimeHours: 0, overtimeCents: 0, regularCents: 90_000 });
  });

  it("pays nothing for absence, leave or a missing clock-out", () => {
    const result = computePayslip({ ...base, entries: [day("2026-10-01", null), day("2026-10-02", 0)] });

    expect(result).toMatchObject({ regularHours: 0, regularCents: 0, lateCents: 0, overtimeCents: 0 });
  });

  it("rounds the hourly rate and each line to whole cents", () => {
    // ₱30,000 / 30 / 9 h = 11111.11 cents, rounded to 11111.
    const result = computePayslip({
      baseSalaryCents: 3_000_000,
      scheduledHoursPerDay: 9,
      entries: [day("2026-10-01", 9.5), day("2026-10-02", 8.75)],
      overtimeRanges: [{ start_date: "2026-10-01", end_date: null, overtime_hours: null }],
    });

    expect(result.hourlyRateCents).toBe(11_111);
    expect(result.regularCents).toBe(199_998);
    expect(result.overtimeCents).toBe(6_944); // 0.5 h × 11111 × 1.25 = 6944.375
    expect(result.lateCents).toBe(2_778); // 15 min × 11111 / 60 = 2777.75
    for (const cents of [result.regularCents, result.overtimeCents, result.lateCents]) {
      expect(Number.isInteger(cents)).toBe(true);
    }
  });
});

describe("scheduledHours", () => {
  it("reads hours between two TIME values", () => {
    expect(scheduledHours("08:00:00", "17:00:00")).toBe(9);
    expect(scheduledHours("08:30:00", "12:00:00")).toBe(3.5);
  });
});
