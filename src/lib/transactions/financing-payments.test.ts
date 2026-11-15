import { describe, expect, it } from "vitest";

import {
  advancedPaymentTotal,
  canMarkFinancingSold,
  confirmedPaymentTotal,
  isAwaitingConfirmation,
  isConfirmedPayment,
  isOpenCheckout,
  nextUnpaidInstallment,
  paidInstallmentCount,
  paidToDate,
  paymentPurposeLabel,
  remainingBalance,
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

describe("paid to date and remaining balance", () => {
  // One verified payment sets its installment to 'paid' (verifyPayment), so the two figures agree.
  const schedule = [
    { id: "1", state: "paid", due_date: "2027-01-15", amount_due: 400 },
    { id: "2", state: "paid", due_date: "2027-02-15", amount_due: 600 },
    { id: "3", state: "upcoming", due_date: "2027-03-15", amount_due: 500 },
  ];

  it("sums the paid installments, and only those", () => {
    expect(paidToDate(schedule, [])).toBe(1000);
    expect(paidToDate([], [])).toBe(0);
  });

  it("sums confirmed payments only: a verified one counts, a rejected or unverified one does not", () => {
    expect(
      confirmedPaymentTotal([
        { amount: "400.00", verified_by: "ha-1" },
        { amount: 600, verified_by: "ha-1", rejected_at: null },
        { amount: 999, verified_by: null },
        { amount: 999, rejected_at: "2027-01-01" },
      ]),
    ).toBe(1000);
    expect(confirmedPaymentTotal([])).toBe(0);
  });

  it("agrees with confirmedPaymentTotal once the Head Accountant has confirmed", () => {
    const confirmed = [
      { amount: 400, verified_by: "ha-1" },
      { amount: 600, verified_by: "ha-1" },
    ];
    expect(paidToDate(schedule, confirmed)).toBe(confirmedPaymentTotal(confirmed));
  });

  it("keeps a rejected payment out of the confirmed total", () => {
    expect(isConfirmedPayment({ verified_by: "ha-1", rejected_at: "2027-01-01" })).toBe(false);
    expect(isConfirmedPayment({ verified_by: "ha-1" })).toBe(true);
    expect(isConfirmedPayment({})).toBe(false);
  });

  it("never reports a negative remaining balance and floors at zero", () => {
    expect(remainingBalance("1500", 1000)).toBe(500);
    expect(remainingBalance(1000, 1000)).toBe(0);
    expect(remainingBalance(1000, 1200)).toBe(0);
    expect(remainingBalance(null, 0)).toBe(0);
  });

  it("flags a recorded payment awaiting confirmation, but not a live or open one", () => {
    expect(isAwaitingConfirmation({ amount: 500, method: "cash" })).toBe(true);
    expect(isAwaitingConfirmation({ amount: 500, verified_by: "ha-1" })).toBe(false);
    expect(isAwaitingConfirmation({ amount: 500, rejected_at: "2027-01-01" })).toBe(false);
    expect(isAwaitingConfirmation({ amount: 500, paymongo_checkout_id: "cs_1" })).toBe(false);
  });
});
