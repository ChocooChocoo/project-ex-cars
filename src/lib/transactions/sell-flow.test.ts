import { describe, expect, it } from "vitest";

import { approvedCeiling, sellPapersVerified } from "./sell-flow";
import { reviewDueAt } from "./state-machine";

const doc = (document_kind: string, verification_state = "verified") => ({ document_kind, verification_state });

describe("sellPapersVerified", () => {
  it("needs two verified IDs, a verified ORCR and a verified deed of sale", () => {
    expect(sellPapersVerified([doc("valid_id"), doc("valid_id"), doc("orcr"), doc("deed_of_sale")])).toBe(true);
  });

  it("refuses a missing or unverified paper", () => {
    expect(sellPapersVerified([doc("valid_id"), doc("orcr"), doc("deed_of_sale")])).toBe(false);
    expect(sellPapersVerified([doc("valid_id"), doc("valid_id", "pending"), doc("orcr"), doc("deed_of_sale")])).toBe(
      false,
    );
    expect(sellPapersVerified([doc("valid_id"), doc("valid_id"), doc("deed_of_sale")])).toBe(false);
    expect(sellPapersVerified([doc("valid_id"), doc("valid_id"), doc("orcr", "rejected"), doc("deed_of_sale")])).toBe(
      false,
    );
  });
});

describe("approvedCeiling", () => {
  const proposal = (proposal_kind: string, decision: string, proposed_amount: number, created_at: string) => ({
    proposal_kind,
    decision,
    proposed_amount,
    created_at,
  });

  it("is null until the CEO approves a ceiling", () => {
    expect(approvedCeiling([])).toBeNull();
    expect(approvedCeiling([proposal("purchase_ceiling", "pending", 500000, "2026-09-01T00:00:00Z")])).toBeNull();
    expect(approvedCeiling([proposal("selling_price", "approved", 900000, "2026-09-01T00:00:00Z")])).toBeNull();
  });

  it("uses the newest approved ceiling, so a revised ceiling replaces the first one", () => {
    expect(
      approvedCeiling([
        proposal("purchase_ceiling", "approved", 500000, "2026-09-01T00:00:00Z"),
        proposal("revised_ceiling", "approved", 450000, "2026-09-10T00:00:00Z"),
        proposal("revised_ceiling", "rejected", 300000, "2026-09-12T00:00:00Z"),
      ]),
    ).toBe(450000);
  });
});

describe("reviewDueAt", () => {
  it("opens a 7-day window", () => {
    expect(reviewDueAt(new Date("2026-09-30T12:00:00Z"))).toBe("2026-10-07T12:00:00.000Z");
  });
});
