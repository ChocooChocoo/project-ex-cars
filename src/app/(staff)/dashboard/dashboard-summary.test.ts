import { describe, expect, it } from "vitest";

import { percentChange, summarizeDashboard } from "./dashboard-summary";

// 2026-10-26 10:00 in Manila.
const now = new Date("2026-10-26T02:00:00Z");

describe("percentChange", () => {
  it("is the rounded change against the previous value", () => {
    expect(percentChange(12, 10)).toBe(20);
    expect(percentChange(5, 10)).toBe(-50);
    expect(percentChange(10, 10)).toBe(0);
  });

  it("has no percentage when there is nothing to compare with", () => {
    expect(percentChange(4, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});

describe("summarizeDashboard", () => {
  const transactions = [
    // c1: first transaction 2 months ago, completed last month.
    {
      customer_id: "c1",
      opened_at: "2026-08-20T03:00:00Z",
      completed_at: "2026-09-10T03:00:00Z",
      current_state: "completed",
    },
    // c1 again this month: not a new customer.
    { customer_id: "c1", opened_at: "2026-10-20T03:00:00Z", completed_at: null, current_state: "pending" },
    // c2: new in the last 30 days, completed this month.
    {
      customer_id: "c2",
      opened_at: "2026-10-05T03:00:00Z",
      completed_at: "2026-10-15T03:00:00Z",
      current_state: "completed",
    },
    // c3: new in the last 30 days, still open.
    { customer_id: "c3", opened_at: "2026-10-25T03:00:00Z", completed_at: null, current_state: "under_review" },
    // c4: new 31-60 days ago, cancelled.
    { customer_id: "c4", opened_at: "2026-09-10T03:00:00Z", completed_at: null, current_state: "cancelled" },
    // Completed on 1 Oct 01:00 Manila (30 Sep UTC): counts for October in Manila time.
    {
      customer_id: "c5",
      opened_at: "2026-09-01T03:00:00Z",
      completed_at: "2026-09-30T17:00:00Z",
      current_state: "completed",
    },
  ];
  // Verified customer payments in pesos, dated when paid.
  const revenue = [
    { amount: 400_000, date: "2026-10-02T03:00:00Z" },
    { amount: "100000.00", date: "2026-10-03" },
    { amount: 250_000, date: "2026-09-02T03:00:00Z" },
    { amount: 999, date: null },
  ];

  const summary = summarizeDashboard({ transactions, revenue, availableVehicles: 17 }, now);

  it("counts completed sales by Manila month and compares with last month", () => {
    expect(summary.salesThisMonth).toBe(2);
    expect(summary.salesLastMonth).toBe(1);
    expect(summary.salesChange).toBe(100);
  });

  it("counts customers whose first transaction is in the last 30 days", () => {
    expect(summary.newCustomers).toBe(2);
    expect(summary.newCustomersPrevious).toBe(2);
    expect(summary.newCustomersChange).toBe(0);
  });

  it("counts customers with an open transaction once", () => {
    expect(summary.activeCustomers).toBe(2);
  });

  it("sums verified payments in pesos for this month and last month", () => {
    expect(summary.revenueThisMonth).toBe(500_000);
    expect(summary.revenueLastMonth).toBe(250_000);
    expect(summary.revenueChange).toBe(100);
  });

  it("passes available vehicles through", () => {
    expect(summary.availableVehicles).toBe(17);
  });

  it("builds a 12-month series ending this month", () => {
    expect(summary.monthly).toHaveLength(12);
    expect(summary.monthly.at(-1)).toEqual({ month: "2026-10", sales: 2, newCustomers: 2 });
    expect(summary.monthly.at(-2)).toEqual({ month: "2026-09", sales: 1, newCustomers: 2 });
    expect(summary.monthly[0].month).toBe("2025-11");
  });

  it("returns zeros, not errors, with no data", () => {
    const empty = summarizeDashboard({ transactions: [], revenue: null, availableVehicles: 0 }, now);
    expect(empty.salesThisMonth).toBe(0);
    expect(empty.revenueThisMonth).toBeNull();
    expect(empty.monthly.every((m) => m.sales === 0 && m.newCustomers === 0)).toBe(true);
  });
});
