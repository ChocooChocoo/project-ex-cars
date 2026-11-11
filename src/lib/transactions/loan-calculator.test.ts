import { describe, expect, it } from "vitest";

import { computeLoan, monthlyInstallment } from "./loan-calculator";

describe("T06 loan calculator", () => {
  it("splits the balance after the downpayment evenly, rounded up", () => {
    expect(monthlyInstallment(1_100_000, 100_000, 12)).toBe(83_334);
    expect(monthlyInstallment(100, 200, 12)).toBe(0);
  });

  it("prices every term with GCE's markup and checks the income", () => {
    const loan = computeLoan({ price: 1_000_000, markupPct: 10, monthlyIncome: 100_000 });
    expect(loan.total).toBe(1_100_000);
    expect(loan.downPayment).toBe(100_000);
    expect(loan.financed).toBe(1_000_000);
    expect(loan.terms.find((t) => t.months === 36)).toEqual({ months: 36, monthly: 27_778, eligible: true });
    expect(loan.terms.find((t) => t.months === 24)?.eligible).toBe(false);
  });

  it("marks nothing eligible without an income", () => {
    const loan = computeLoan({ price: 500_000, markupPct: 10, monthlyIncome: 0 });
    expect(loan.terms.every((t) => !t.eligible)).toBe(true);
  });
});
