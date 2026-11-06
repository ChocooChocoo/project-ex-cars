import { describe, expect, it } from "vitest";

import { canCancelScheduled, canTransition, getAllowedTransitions, isOverdue, nextQueueState } from "./state-machine";

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

describe("T07 cancellation permissions", () => {
  it.each(["pending", "under_review", "approved"] as const)("denies Sales Manager cancellation in %s", (state) => {
    expect(canTransition(state, "cancelled", "sales_manager")).toBe(false);
    expect(canTransition(state, "cancelled", "ceo")).toBe(true);
  });

  it("preserves Account Manager cancellation of pending requests", () => {
    expect(canTransition("pending", "cancelled", "account_manager")).toBe(true);
    expect(getAllowedTransitions("under_review", "sales_manager")).toEqual(["approved", "rejected"]);
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
