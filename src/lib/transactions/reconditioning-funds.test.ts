import { describe, expect, it } from "vitest";

import { partsTotalCents, reconditioningRefundCents, releasedFundsCents } from "./reconditioning-funds";

describe("reconditioning funds", () => {
  it("totals peso and cent estimates", () => {
    expect(partsTotalCents([{ estimated_cost: 1500 }, { estimated_cost_cents: 25050 }])).toBe(175050);
  });

  it("counts only released, received or paid requests", () => {
    expect(
      releasedFundsCents([
        { amount_cents: 100000, disbursement_requests: { status: "released" } },
        { amount_cents: 50000, disbursement_requests: { status: "submitted" } },
        { amount_cents: 25000, disbursement_requests: { status: "paid" } },
      ]),
    ).toBe(125000);
  });

  it("falls back to the request's own state when the join is hidden", () => {
    expect(
      releasedFundsCents([
        { amount_cents: 100000, state: "released" },
        { amount_cents: 50000, state: "submitted" },
      ]),
    ).toBe(100000);
  });

  it("falls back to the legacy single disbursement", () => {
    expect(releasedFundsCents([], { status: "released", amount_cents: 90000 })).toBe(90000);
    expect(releasedFundsCents([], { status: "draft", amount_cents: 90000 })).toBe(0);
  });

  it("never returns a negative refund", () => {
    expect(reconditioningRefundCents(100000, 80000)).toBe(20000);
    expect(reconditioningRefundCents(80000, 100000)).toBe(0);
  });
});
