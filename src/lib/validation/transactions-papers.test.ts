import { describe, expect, it } from "vitest";

import { sellVehicleSchema } from "@/lib/validation/transactions";
import { SELL_PAPER_FIELDS, SELL_PAPER_STATUSES } from "@/lib/vehicles/catalog";

// SN-13: the three papers are declared on a checklist, not uploaded. The schema, the Laravel rule and the JSON
// column must agree, so these fixtures mirror the payload the form builds.
function baseData(overrides: Record<string, unknown> = {}) {
  return {
    make: "Honda",
    model: "Civic",
    year: 2020,
    mileage: 50000,
    condition: "Good",
    offered_amount: 450000,
    has_known_issues: "no",
    meetup_method: "gce_visit",
    owner_number: "1",
    papers_checklist: {
      official_receipt: "has",
      certificate_of_registration: "has",
      deed_of_sale: "has",
    },
    signed_id_copies: true,
    ...overrides,
  };
}

describe("sellVehicleSchema papers checklist (SN-13)", () => {
  it("accepts the answers as a JSON field, the way the form sends them", () => {
    const parsed = sellVehicleSchema.safeParse(
      baseData({
        papers_checklist: JSON.stringify({
          official_receipt: "has",
          certificate_of_registration: "expired",
          deed_of_sale: "does_not_have",
        }),
      }),
    );

    expect(parsed.success).toBe(true);
    expect(parsed.data?.papers_checklist).toEqual({
      official_receipt: "has",
      certificate_of_registration: "expired",
      deed_of_sale: "does_not_have",
    });
  });

  it("requires every answer: an offer cannot be sent with the checklist half filled", () => {
    expect(sellVehicleSchema.safeParse(baseData({ papers_checklist: undefined })).success).toBe(false);
    for (const missing of SELL_PAPER_FIELDS.map((paper) => paper.key)) {
      const answers: Record<string, string> = {
        official_receipt: "has",
        certificate_of_registration: "has",
        deed_of_sale: "has",
      };
      delete answers[missing];
      expect(sellVehicleSchema.safeParse(baseData({ papers_checklist: answers })).success).toBe(false);
    }
  });

  it("accepts an expired deed of sale (notes line 115)", () => {
    expect(
      sellVehicleSchema.safeParse(
        baseData({
          papers_checklist: { official_receipt: "has", certificate_of_registration: "has", deed_of_sale: "expired" },
        }),
      ).success,
    ).toBe(true);
  });

  it("requires the signed ID copies tick (notes line 116)", () => {
    expect(sellVehicleSchema.safeParse(baseData({ signed_id_copies: undefined })).success).toBe(false);
    expect(sellVehicleSchema.safeParse(baseData({ signed_id_copies: false })).success).toBe(false);
  });

  it("rejects an answer outside the three statuses", () => {
    expect(
      sellVehicleSchema.safeParse(
        baseData({
          papers_checklist: { official_receipt: "maybe", certificate_of_registration: "has", deed_of_sale: "has" },
        }),
      ).success,
    ).toBe(false);
  });

  it("keeps the notice wording the client asked for", () => {
    // The copy lives in the form; the statuses here are the vocabulary the API accepts.
    expect(SELL_PAPER_STATUSES).toEqual(["has", "does_not_have", "expired"]);
    expect(SELL_PAPER_FIELDS.map((paper) => paper.key)).toEqual([
      "official_receipt",
      "certificate_of_registration",
      "deed_of_sale",
    ]);
    expect(SELL_PAPER_FIELDS.at(-1)?.statuses).toEqual(["has", "does_not_have", "expired"]);
  });
});
