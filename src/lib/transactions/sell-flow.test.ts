import { describe, expect, it } from "vitest";

import {
  approvedCeiling,
  approvedCeilingOfKind,
  GCE_LOCATION,
  GCE_LOCATION_LABEL,
  halfwayPoint,
  sellerSafeNote,
  sellPapersVerified,
} from "./sell-flow";
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

  it("SN-11: needs only the two verified IDs, front and back, before a ceiling is proposed", () => {
    expect(sellPapersVerified(fullIds)).toBe(true);
    expect(sellPapersVerified(fullIds.slice(0, 3))).toBe(false);
    expect(sellPapersVerified([...fullIds.slice(0, 3), id("umid", "back", "pending")])).toBe(false);
  });

  it("SN-11: no longer waits for the OR, the CR or the deed of sale, which are inspected on site", () => {
    expect(sellPapersVerified([...fullIds, doc("official_receipt"), doc("certificate_of_registration")])).toBe(true);
    expect(sellPapersVerified([...fullIds, doc("orcr"), doc("deed_of_sale")])).toBe(true);
    expect(sellPapersVerified(fullIds)).toBe(true);
  });

  it("still accepts an offer sent under the old rule, which uploaded the papers as well", () => {
    expect(sellPapersVerified([doc("valid_id"), doc("valid_id"), doc("orcr"), doc("deed_of_sale")])).toBe(true);
  });

  it("refuses a missing or unverified ID", () => {
    expect(sellPapersVerified([doc("valid_id"), doc("orcr"), doc("deed_of_sale")])).toBe(false);
    expect(sellPapersVerified([doc("valid_id"), doc("valid_id", "pending"), doc("orcr"), doc("deed_of_sale")])).toBe(
      false,
    );
    expect(sellPapersVerified([])).toBe(false);
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

  it("prefers the revision when both ceilings carry the same timestamp", () => {
    // A fast hand-off can mint both rows in one second; the revision is still the newer decision.
    const sameSecond = "2026-09-10T00:00:00Z";
    expect(
      approvedCeiling([
        proposal("purchase_ceiling", "approved", 450000, sameSecond),
        proposal("revised_ceiling", "approved", 415000, sameSecond),
      ]),
    ).toBe(415000);
    expect(
      approvedCeiling([
        proposal("revised_ceiling", "approved", 415000, sameSecond),
        proposal("purchase_ceiling", "approved", 450000, sameSecond),
      ]),
    ).toBe(415000);
  });
});

describe("approvedCeilingOfKind (SH-6 facts grid)", () => {
  const proposal = (proposal_kind: string, decision: string, proposed_amount: number, created_at: string) => ({
    proposal_kind,
    decision,
    proposed_amount,
    created_at,
  });
  const rows = [
    proposal("purchase_ceiling", "approved", 500000, "2026-09-01T00:00:00Z"),
    proposal("revised_ceiling", "approved", 415000, "2026-09-10T00:00:00Z"),
    proposal("revised_ceiling", "rejected", 300000, "2026-09-12T00:00:00Z"),
    proposal("revised_ceiling", "pending", 410000, "2026-09-13T00:00:00Z"),
  ];

  it("reads each ceiling kind on its own, so the grid can label them separately", () => {
    expect(approvedCeilingOfKind(rows, "purchase_ceiling")).toBe(500000);
    expect(approvedCeilingOfKind(rows, "revised_ceiling")).toBe(415000);
  });

  it("is null when that kind has no approved row yet", () => {
    expect(approvedCeilingOfKind([], "revised_ceiling")).toBeNull();
    expect(approvedCeilingOfKind(rows, "purchase_ceiling")).toBe(500000);
    expect(approvedCeilingOfKind([rows[0]], "revised_ceiling")).toBeNull();
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
    // SH-6: the negotiated price is the seller's own, so it is safe where the ceiling never is.
    expect(sellerSafeNote("Seller agreed to the negotiated price of ₱400,000; cleared for payment")).toContain(
      "negotiated price",
    );
  });
  it("hides ceilings, CEO decisions and the staff-only profitability note", () => {
    expect(sellerSafeNote("Purchase ceiling of ₱480,000 proposed to the CEO")).toBeNull();
    expect(sellerSafeNote("Purchase ceiling of ₱480,000 rejected by the CEO")).toBeNull();
    expect(sellerSafeNote("Revised ceiling of ₱415,000 approved by the CEO")).toBeNull();
    expect(sellerSafeNote("Cancelled: not profitable after inspection. Margin too thin")).toBeNull();
    expect(sellerSafeNote(null)).toBeNull();
  });
});

describe("T12 halfwayPoint", () => {
  it("is the midpoint between GCE and the seller", () => {
    expect(halfwayPoint(GCE_LOCATION, GCE_LOCATION)).toEqual(GCE_LOCATION);
    const point = halfwayPoint({ lat: 14, lng: 121 }, { lat: 14.5, lng: 120 });
    expect(point.lat).toBeCloseTo(14.25);
    expect(point.lng).toBeCloseTo(120.5);
  });
});

describe("SH-14 GCE_LOCATION", () => {
  it("pins GCE on the client's plus code 8XG3+XC8, not DLSU-D Gate 3", () => {
    expect(GCE_LOCATION).toEqual({ lat: 14.32741, lng: 120.95359 });
    expect(GCE_LOCATION_LABEL).toBe("GCE, 8XG3+XC8, Dominador Mangubat Blvd, Dasmariñas, Cavite");
  });
});
