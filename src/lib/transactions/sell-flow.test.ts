import { describe, expect, it } from "vitest";

import { approvedCeiling, sellerSafeNote, sellPapersVerified } from "./sell-flow";
import { reviewDueAt } from "./state-machine";

const doc = (document_kind: string, verification_state = "verified") => ({ document_kind, verification_state });

describe("sellPapersVerified", () => {
  const id = (id_type: string, id_side: string, verification_state = "verified") => ({
    document_kind: "valid_id",
    verification_state,
    id_type,
    id_side,
  });
  const fullIds = [id("passport", "front"), id("passport", "back"), id("umid", "front"), id("umid", "back")];

  it("T10: needs both IDs front and back, the OR, the CR and the deed", () => {
    const papers = [...fullIds, doc("official_receipt"), doc("certificate_of_registration"), doc("deed_of_sale")];
    expect(sellPapersVerified(papers)).toBe(true);
    expect(sellPapersVerified(papers.filter((paper) => paper.document_kind !== "certificate_of_registration"))).toBe(
      false,
    );
    expect(sellPapersVerified([...papers.slice(1)])).toBe(false);
    expect(sellPapersVerified([...fullIds.slice(0, 3), id("umid", "back", "pending"), ...papers.slice(4)])).toBe(false);
  });

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

describe("sellerSafeNote (T10)", () => {
  it("shows the seller only the notes meant for them", () => {
    expect(sellerSafeNote("Rejected at verification: The ORCR is blurred")).toBe("The ORCR is blurred");
    expect(sellerSafeNote("Price agreed at ₱500,000; acquisition field case created")).toContain("Price agreed");
  });
  it("hides ceilings, CEO decisions and the staff-only profitability note", () => {
    expect(sellerSafeNote("Purchase ceiling of ₱480,000 proposed to the CEO")).toBeNull();
    expect(sellerSafeNote("Purchase ceiling of ₱480,000 rejected by the CEO")).toBeNull();
    expect(sellerSafeNote("Cancelled: not profitable after inspection. Margin too thin")).toBeNull();
    expect(sellerSafeNote(null)).toBeNull();
  });
});
