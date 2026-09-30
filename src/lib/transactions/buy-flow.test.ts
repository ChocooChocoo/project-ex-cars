import { describe, expect, it } from "vitest";

import {
  activeBuyerIdCount,
  addWorkingDays,
  canRecordNoShow,
  isDeliveryCashRequest,
  isHalfwayCashRequest,
  isOnsiteCashRequest,
  isQueuedCashRequest,
  isVisitSlot,
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
