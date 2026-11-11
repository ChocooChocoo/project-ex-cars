import { describe, expect, it } from "vitest";

import {
  advancedPaymentTotal,
  canMarkFinancingSold,
  isOpenCheckout,
  nextUnpaidInstallment,
  paidInstallmentCount,
  paymentPurposeLabel,
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

describe("payment history helpers", () => {
  it("treats an unpaid PayMongo session as no payment", () => {
    expect(isOpenCheckout({ paymongo_checkout_id: "cs_1" })).toBe(true);
    expect(isOpenCheckout({ paymongo_checkout_id: "cs_1", paymongo_payment_id: "pay_1" })).toBe(false);
    expect(isOpenCheckout({ method: "cash" })).toBe(false);
  });

  it("names the installment a row pays", () => {
    const installments = [{ id: "i1", sequence_no: 1, due_date: "2026-12-10" }];
    expect(paymentPurposeLabel({ installment_id: "i1" }, installments, String)).toBe("Installment #1 (due 2026-12-10)");
    expect(paymentPurposeLabel({ payment_kind: "downpayment" }, installments, (kind) => `K:${kind}`)).toBe(
      "K:downpayment",
    );
  });
});
