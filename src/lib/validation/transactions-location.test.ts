import { describe, expect, it } from "vitest";

import { buyDetailsSchema } from "./transactions";

describe("purchase location", () => {
  const base = { transaction_id: "22222222-2222-4222-8222-222222222222", payment_method: "cash" };
  it.each(["meetup", "delivery"])("requires a nonblank location for %s", (arrangement_kind) => {
    for (const location of [undefined, "", "   "]) {
      expect(buyDetailsSchema.safeParse({ ...base, arrangement_kind, location }).success).toBe(false);
    }
    expect(buyDetailsSchema.parse({ ...base, arrangement_kind, location: " Calamba " }).location).toBe("Calamba");
  });
  it("allows GCE visits without an address", () => {
    expect(buyDetailsSchema.safeParse({ ...base, arrangement_kind: "gce_visit" }).success).toBe(true);
  });
});
