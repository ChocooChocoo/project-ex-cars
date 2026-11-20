import { describe, expect, it } from "vitest";

import { buyDetailsSchema } from "./transactions";

describe("purchase location", () => {
  const base = { transaction_id: "22222222-2222-4222-8222-222222222222", payment_method: "cash" };
  // T10: delivery is still a PSGC address, composed by the browser into one line.
  it("requires a nonblank location for delivery", () => {
    for (const location of [undefined, "", "   "]) {
      expect(buyDetailsSchema.safeParse({ ...base, arrangement_kind: "delivery", location }).success).toBe(false);
    }
    expect(buyDetailsSchema.parse({ ...base, arrangement_kind: "delivery", location: " Calamba " }).location).toBe(
      "Calamba",
    );
  });
  // BH-8: a Meet Halfway meet-up is a pin inside CALABARZON plus the address the pin filled, not a PSGC address.
  it("requires the meet-up pin for a meetup instead of a PSGC location", () => {
    expect(buyDetailsSchema.safeParse({ ...base, arrangement_kind: "meetup", location: "Calamba" }).success).toBe(
      false,
    );
    expect(buyDetailsSchema.safeParse({ ...base, arrangement_kind: "meetup", meetup_lat: 14.33 }).success).toBe(false);
    const parsed = buyDetailsSchema.safeParse({
      ...base,
      arrangement_kind: "meetup",
      meetup_lat: 14.33,
      meetup_lng: 120.94,
      meetup_address: "Lot 1, Banadero, Calamba, Laguna, Calabarzon",
    });
    expect(parsed.success).toBe(true);
  });
  // The API stores the composed address as the meet-up location, so a blank one is a 422 there. Catching it
  // inline keeps the buyer from seeing a server toast for a pin that looked valid.
  it("requires the auto-filled meet-up address, not only the pin", () => {
    const pin = { ...base, arrangement_kind: "meetup", meetup_lat: 14.33, meetup_lng: 120.94 };
    for (const meetup_address of [undefined, "", "   "]) {
      const parsed = buyDetailsSchema.safeParse({ ...pin, meetup_address });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.path).toEqual(["meetup_address"]);
    }
  });
  it("refuses a meet-up pin outside CALABARZON (SH-14)", () => {
    for (const [meetup_lat, meetup_lng] of [
      [15.5, 121],
      [10.3, 123.9],
      [51.5, -0.12],
    ]) {
      const parsed = buyDetailsSchema.safeParse({ ...base, arrangement_kind: "meetup", meetup_lat, meetup_lng });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe("Meet-ups must be inside CALABARZON.");
    }
  });
  it("allows GCE visits without an address", () => {
    expect(buyDetailsSchema.safeParse({ ...base, arrangement_kind: "gce_visit" }).success).toBe(true);
  });
});
