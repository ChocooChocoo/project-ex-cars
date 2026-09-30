import { describe, expect, it } from "vitest";

import {
  activeBuyerIdCount,
  addWorkingDays,
  balanceMethodPhrase,
  canRecordNoShow,
  financingFullyPaid,
  isDeliveryCashRequest,
  isFinancingVisitRequest,
  isHalfwayCashRequest,
  isOnsiteCashRequest,
  isQueuedCashRequest,
  isQueuedRequest,
  isVisitSlot,
  MISSED_INSTALLMENTS_BEFORE_REPOSSESSION,
  missedInstallments,
  nextDeliveryStatus,
  nextStanding,
  verifiedPaid,
} from "./buy-flow";
import { canTransition } from "./state-machine";

describe("activeBuyerIdCount", () => {
  it("counts pending and verified IDs but not rejected ones or other papers", () => {
    expect(
      activeBuyerIdCount([
        { document_kind: "valid_id", verification_state: "pending" },
        { document_kind: "valid_id", verification_state: "verified" },
        { document_kind: "valid_id", verification_state: "rejected" },
        { document_kind: "proof_of_billing", verification_state: "verified" },
      ]),
    ).toBe(2);
  });
});

describe("isOnsiteCashRequest", () => {
  it("is Cash paid at a GCE visit only", () => {
    expect(isOnsiteCashRequest({ payment_method: "cash", arrangement_kind: "gce_visit" })).toBe(true);
    expect(isOnsiteCashRequest({ payment_method: "cash", arrangement_kind: "meetup" })).toBe(false);
    expect(isOnsiteCashRequest({ payment_method: "financing", arrangement_kind: "gce_visit" })).toBe(false);
    expect(isOnsiteCashRequest(null)).toBe(false);
  });
});

describe("§7–9 bank transfer", () => {
  it("follows the Cash flow for each arrangement", () => {
    expect(isOnsiteCashRequest({ payment_method: "bank_transfer", arrangement_kind: "gce_visit" })).toBe(true);
    expect(isHalfwayCashRequest({ payment_method: "bank_transfer", arrangement_kind: "meetup" })).toBe(true);
    expect(isDeliveryCashRequest({ payment_method: "bank_transfer", arrangement_kind: "delivery" })).toBe(true);
    expect(isQueuedRequest({ payment_method: "bank_transfer", arrangement_kind: "gce_visit" })).toBe(false);
    expect(isOnsiteCashRequest({ payment_method: "cheque", arrangement_kind: "gce_visit" })).toBe(false);
  });

  it("words the balance by method", () => {
    expect(balanceMethodPhrase("bank_transfer")).toBe("by bank transfer");
    expect(balanceMethodPhrase("cash")).toBe("in cash");
  });
});

describe("isVisitSlot", () => {
  const now = new Date(2026, 8, 30, 12, 0, 0);

  it("accepts a future whole hour", () => {
    expect(isVisitSlot(new Date(2026, 9, 1, 10, 0, 0), now)).toBe(true);
  });

  it("refuses past times and times off the hour", () => {
    expect(isVisitSlot(new Date(2026, 8, 30, 11, 0, 0), now)).toBe(false);
    expect(isVisitSlot(new Date(2026, 9, 1, 10, 30, 0), now)).toBe(false);
    expect(isVisitSlot(new Date("not a date"), now)).toBe(false);
  });
});

describe("buyer request approval (Q0a)", () => {
  it("lets the Sales Manager approve or reject, with the CEO as override", () => {
    for (const role of ["sales_manager", "ceo"]) {
      expect(canTransition("under_review", "approved", role)).toBe(true);
      expect(canTransition("under_review", "rejected", role)).toBe(true);
    }
    expect(canTransition("under_review", "approved", "head_accountant")).toBe(false);
    expect(canTransition("under_review", "approved", "account_manager")).toBe(false);
  });
});

describe("isHalfwayCashRequest", () => {
  it("is Cash at a Calabarzon meet-up only", () => {
    expect(isHalfwayCashRequest({ payment_method: "cash", arrangement_kind: "meetup" })).toBe(true);
    expect(isHalfwayCashRequest({ payment_method: "cash", arrangement_kind: "gce_visit" })).toBe(false);
  });
});

describe("canRecordNoShow", () => {
  const schedule = new Date("2026-10-01T10:00:00Z");

  it("waits 2 hours 30 minutes after the meet-up time", () => {
    expect(canRecordNoShow(schedule, new Date("2026-10-01T12:29:59Z"))).toBe(false);
    expect(canRecordNoShow(schedule, new Date("2026-10-01T12:30:00Z"))).toBe(true);
  });
});

describe("nextStanding", () => {
  it("restricts a buyer to GCE Visit only on the second no-show", () => {
    const first = nextStanding(null, "no_show");
    expect(first).toEqual({ no_show_count: 1, strike_count: 0, gce_visit_only: false });
    expect(nextStanding(first, "no_show")).toEqual({ no_show_count: 2, strike_count: 0, gce_visit_only: true });
  });

  it("restricts a buyer immediately on a Not Legit decline", () => {
    expect(nextStanding(null, "strike")).toEqual({ no_show_count: 0, strike_count: 1, gce_visit_only: true });
  });
});

describe("delivery rules", () => {
  it("queues Meet Halfway and Delivery Cash requests, not GCE visits", () => {
    expect(isQueuedCashRequest({ payment_method: "cash", arrangement_kind: "delivery" })).toBe(true);
    expect(isQueuedCashRequest({ payment_method: "cash", arrangement_kind: "meetup" })).toBe(true);
    expect(isQueuedCashRequest({ payment_method: "cash", arrangement_kind: "gce_visit" })).toBe(false);
    expect(isDeliveryCashRequest({ payment_method: "financing", arrangement_kind: "delivery" })).toBe(false);
  });

  it("counts the downpayment deadline in working days", () => {
    // Thursday 2026-10-01 + 3 working days skips the weekend: Tuesday 2026-10-06.
    expect(addWorkingDays(new Date(2026, 9, 1, 12), 3)).toEqual(new Date(2026, 9, 6, 12));
    // Friday + 1 working day is Monday.
    expect(addWorkingDays(new Date(2026, 9, 2, 12), 1)).toEqual(new Date(2026, 9, 5, 12));
  });

  it("moves delivery tracking forward one step at a time", () => {
    expect(nextDeliveryStatus(null)).toBe("dispatched");
    expect(nextDeliveryStatus("dispatched")).toBe("in_transit");
    expect(nextDeliveryStatus("arriving")).toBe("delivered");
    expect(nextDeliveryStatus("delivered")).toBeNull();
  });

  it("counts only verified payments of the asked kind", () => {
    const payments = [
      { payment_kind: "delivery_fee", amount: 1500, verified_by: "ha" },
      { payment_kind: "downpayment", amount: 50000, verified_by: null },
      { payment_kind: "downpayment", amount: 20000, verified_by: "ha" },
    ];
    expect(verifiedPaid(payments, "delivery_fee")).toBe(1500);
    expect(verifiedPaid(payments, "downpayment")).toBe(20000);
  });
});

describe("financing rules", () => {
  it("queues a financing request that inspects at a GCE visit", () => {
    expect(isQueuedRequest({ payment_method: "financing", arrangement_kind: "gce_visit" })).toBe(true);
    expect(isQueuedRequest({ payment_method: "cash", arrangement_kind: "gce_visit" })).toBe(false);
    expect(isFinancingVisitRequest({ payment_method: "financing", arrangement_kind: "delivery" })).toBe(false);
  });

  it("counts unpaid installments past their due date as missed", () => {
    const today = new Date("2026-10-15T12:00:00Z");
    const installments = [
      { state: "paid", due_date: "2026-07-01" },
      { state: "overdue", due_date: "2026-08-01" },
      { state: "upcoming", due_date: "2026-09-01" },
      { state: "waived", due_date: "2026-09-15" },
      { state: "upcoming", due_date: "2026-10-15" },
      { state: "upcoming", due_date: "2026-11-01" },
    ];
    expect(missedInstallments(installments, today)).toBe(2);
    expect(MISSED_INSTALLMENTS_BEFORE_REPOSSESSION).toBe(4);
  });

  it("is fully paid only when every installment is paid or waived", () => {
    expect(
      financingFullyPaid([
        { state: "paid", due_date: "x" },
        { state: "waived", due_date: "y" },
      ]),
    ).toBe(true);
    expect(
      financingFullyPaid([
        { state: "paid", due_date: "x" },
        { state: "due", due_date: "y" },
      ]),
    ).toBe(false);
    expect(financingFullyPaid([])).toBe(false);
  });
});
