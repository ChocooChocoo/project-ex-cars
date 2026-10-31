import { describe, expect, it } from "vitest";

import { vehiclePaperRecord, vehiclePapersAction } from "./vehicle-papers";

describe("vehicle paper rows", () => {
  it("reads the buyer, car and arrangement out of the nested transaction", () => {
    expect(
      vehiclePaperRecord({
        transaction_id: "tx-1",
        papers_status: "requested",
        papers_updated_at: "2026-10-20T08:00:00.000Z",
        transactions: {
          purchase_details: { arrangement_kind: "gce_visit" },
          profiles: { full_name: "Maria Santos" },
          vehicles: { id: "vehicle-1", make: "Toyota", model: "Vios", year: 2022, stock_code: "STK-1" },
        },
      }),
    ).toEqual({
      transactionId: "tx-1",
      vehicle: "2022 Toyota Vios (STK-1)",
      buyer: "Maria Santos",
      status: "requested",
      arrangementKind: "gce_visit",
      updatedAt: "2026-10-20T08:00:00.000Z",
      vehicleId: "vehicle-1",
    });
  });

  it("unwraps nested relations returned as arrays and keeps honest fallbacks", () => {
    const record = vehiclePaperRecord({
      transaction_id: "tx-2",
      papers_status: "released_to_ci",
      papers_updated_at: null,
      transactions: [
        {
          purchase_details: [{ arrangement_kind: "delivery" }],
          profiles: [{ full_name: null }],
          vehicles: [{ id: "vehicle-2", make: "Honda", model: "City", year: 2021, stock_code: "STK-2" }],
        },
      ],
    });
    expect(record.buyer).toBe("the buyer");
    expect(record.vehicle).toBe("2021 Honda City (STK-2)");
    expect(record.vehicleId).toBe("vehicle-2");
  });

  it("names a sold car with no vehicle row instead of inventing one", () => {
    const record = vehiclePaperRecord({
      transaction_id: "tx-3",
      papers_status: "handed_over",
      papers_updated_at: null,
      transactions: { purchase_details: null, profiles: null, vehicles: null },
    });
    expect(record.vehicle).toBe("A sold car");
    expect(record.vehicleId).toBeNull();
    expect(record.arrangementKind).toBeNull();
  });
});

describe("vehicle papers release actions", () => {
  it("marks requested papers released by handing them to the Sales Manager", () => {
    expect(vehiclePapersAction("requested", { arrangement_kind: "gce_visit" })).toBe("approve_release");
  });

  it("hands papers already released to the CI over to the buyer", () => {
    expect(vehiclePapersAction("released_to_ci", { arrangement_kind: "meetup" })).toBe("hand_to_buyer");
  });

  it("lets a field row returned to the CI be released again", () => {
    expect(vehiclePapersAction("returned", { arrangement_kind: "delivery" })).toBe("release_to_ci");
  });

  it("offers no action once the papers are released or received", () => {
    expect(vehiclePapersAction("handed_over", { arrangement_kind: "meetup" })).toBeNull();
    expect(vehiclePapersAction("received", { arrangement_kind: "gce_visit" })).toBeNull();
  });

  it("offers no release to the CI for a GCE visit the Sales Manager has not re-requested", () => {
    expect(vehiclePapersAction("returned", { arrangement_kind: "gce_visit" })).toBeNull();
  });
});
