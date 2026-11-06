import { describe, expect, it } from "vitest";

import {
  advancedPaymentTotal,
  canMarkFinancingSold,
  nextUnpaidInstallment,
  paidInstallmentCount,
  unpaidInstallments,
} from "./financing-payments";

const installments = [
  { id: "3", state: "upcoming", due_date: "2027-03-15", amount_due: 125.25 },
  { id: "1", state: "paid", due_date: "2027-01-15", amount_due: 125.25 },
  { id: "2", state: "due", due_date: "2027-02-15", amount_due: 125.25 },
  { id: "4", state: "waived", due_date: "2027-04-15", amount_due: 125.25 },
];

describe("financing payments", () => {
  it("finds the earliest unpaid installment without changing the input", () => {
    expect(nextUnpaidInstallment(installments)?.id).toBe("2");
    expect(unpaidInstallments(installments).map((i) => i.id)).toEqual(["2", "3"]);
    expect(installments[0].id).toBe("3");
  });

  it("counts only paid installments, not waived ones", () => {
    expect(paidInstallmentCount(installments)).toBe(1);
  });

  it("totals whole selected unpaid installments", () => {
    expect(advancedPaymentTotal(installments)).toBe(250.5);
    expect(advancedPaymentTotal([installments[0]])).toBe(125.25);
  });

  it("blocks sold for an empty schedule or any unpaid installment", () => {
    expect(canMarkFinancingSold([])).toBe(false);
    expect(canMarkFinancingSold(installments)).toBe(false);
    expect(canMarkFinancingSold(installments.filter((i) => ["paid", "waived"].includes(i.state)))).toBe(true);
    expect(nextUnpaidInstallment([])).toBeNull();
  });
});
