import { describe, expect, it } from "vitest";

import { buyDetailsSchema } from "./transactions";

const base = {
  transaction_id: "22222222-2222-4222-8222-222222222222",
  payment_method: "financing",
  arrangement_kind: "gce_visit",
  requested_term_months: "12",
};

describe("T11 financing pay method", () => {
  it("requires a pay method when the buyer explicitly picks Financing", () => {
    for (const financing_pay_method of [undefined, ""]) {
      const result = buyDetailsSchema.safeParse({ ...base, payment_option: "financing", financing_pay_method });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Choose Cash or PayMongo for the financing.");
      expect(result.error?.issues[0]?.path).toEqual(["financing_pay_method"]);
    }
  });

  it("accepts Cash or PayMongo for a financing request", () => {
    for (const financing_pay_method of ["cash", "paymongo"]) {
      expect(buyDetailsSchema.safeParse({ ...base, payment_option: "financing", financing_pay_method }).success).toBe(
        true,
      );
    }
  });

  it("refuses a method outside the two the app offers", () => {
    expect(
      buyDetailsSchema.safeParse({ ...base, payment_option: "financing", financing_pay_method: "bank_transfer" })
        .success,
    ).toBe(false);
  });

  // Rows saved before T11 carry no value; they must still parse so the buyer can save them again.
  it("does not require a pay method when the option was never picked", () => {
    expect(buyDetailsSchema.safeParse(base).success).toBe(true);
    expect(buyDetailsSchema.safeParse({ ...base, payment_option: "full" }).success).toBe(true);
  });
});
