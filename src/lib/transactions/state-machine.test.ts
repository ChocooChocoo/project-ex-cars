import { describe, expect, it } from "vitest";

import { canCancelScheduled, canSalesManagerCancel, canTransition, isOverdue, nextQueueState } from "./state-machine";

const now = new Date("2026-09-30T12:00:00Z");

describe("isOverdue", () => {
  it("is false without a review window", () => {
    expect(isOverdue({ current_state: "pending", review_due_at: null }, now)).toBe(false);
  });

  it("is false before and at the due time, true after", () => {
    expect(isOverdue({ current_state: "under_review", review_due_at: "2026-09-30T13:00:00Z" }, now)).toBe(false);
    expect(isOverdue({ current_state: "under_review", review_due_at: "2026-09-30T12:00:00Z" }, now)).toBe(false);
    expect(isOverdue({ current_state: "under_review", review_due_at: "2026-09-30T11:59:59Z" }, now)).toBe(true);
  });

  it("is never true for a terminal transaction", () => {
    for (const state of ["rejected", "completed", "cancelled"] as const) {
      expect(isOverdue({ current_state: state, review_due_at: "2026-09-01T00:00:00Z" }, now)).toBe(false);
    }
  });
});

describe("canCancelScheduled", () => {
  it("allows cancelling at exactly 5 hours or more before the schedule", () => {
    expect(canCancelScheduled("2026-09-30T17:00:00Z", now)).toBe(true);
    expect(canCancelScheduled(new Date("2026-10-01T12:00:00Z"), now)).toBe(true);
  });

  it("refuses inside the 5-hour cut-off and after the schedule", () => {
    expect(canCancelScheduled("2026-09-30T16:59:59Z", now)).toBe(false);
    expect(canCancelScheduled("2026-09-30T10:00:00Z", now)).toBe(false);
  });
});

describe("canSalesManagerCancel", () => {
  const buy = (paymentMethod: string) => ({
    transaction_kind: "buy",
    purchase_details: { payment_method: paymentMethod },
  });

  it("refuses every direct-payment buy", () => {
    expect(canSalesManagerCancel(buy("cash"))).toBe(false);
    expect(canSalesManagerCancel(buy("bank_transfer"))).toBe(false);
  });

  it("keeps the Sales Manager's Cancel on a financing buy", () => {
    expect(canSalesManagerCancel(buy("financing"))).toBe(true);
  });

  it("is not about sell offers or a missing request", () => {
    expect(canSalesManagerCancel({ transaction_kind: "sell", purchase_details: null })).toBe(true);
  });

  it("reads purchase_details whether it comes as a row or an array", () => {
    expect(canSalesManagerCancel({ transaction_kind: "buy", purchase_details: [{ payment_method: "cash" }] })).toBe(
      false,
    );
  });
});

describe("nextQueueState", () => {
  it("queues behind an existing active request", () => {
    expect(nextQueueState(false)).toBe("active");
    expect(nextQueueState(true)).toBe("on_hold");
  });
});

describe("Mark Sold (T05)", () => {
  it("leaves Mark Sold to the Sales Manager and the CEO, not the Head Accountant", () => {
    expect(canTransition("approved", "completed", "sales_manager")).toBe(true);
    expect(canTransition("approved", "completed", "ceo")).toBe(true);
    expect(canTransition("approved", "completed", "head_accountant")).toBe(false);
    expect(canTransition("approved", "completed", "account_manager")).toBe(false);
  });
});
