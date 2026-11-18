import { describe, expect, it } from "vitest";

import { recommendationPreferencesSchema, statedPreferencesSchema } from "./recommendations";

describe("T06 recommendation preferences", () => {
  const required = { make: "Toyota", bodyType: "SUV", seats: "7", purpose: "Family Car" };

  it("needs make, body type, seats and purpose", () => {
    const result = recommendationPreferencesSchema.safeParse({ budget: 800000 });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["make", "bodyType", "seats", "purpose"]),
    );
  });

  it("leaves every other detail optional", () => {
    expect(recommendationPreferencesSchema.safeParse({ budget: 800000, ...required }).success).toBe(true);
    expect(statedPreferencesSchema.safeParse({ ...required, transmission: "manual", minYear: "2018" }).success).toBe(
      true,
    );
  });

  it("T12: rejects a seat count that does not fit the body type", () => {
    const base = { budget: 800000, make: "Toyota", purpose: "Family Car" };
    for (const [bodyType, seats] of [
      ["Sedan", "7"],
      ["Van", "2"],
      ["Van", "4"],
    ]) {
      const result = recommendationPreferencesSchema.safeParse({ ...base, bodyType, seats });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["seats"]);
    }
    expect(statedPreferencesSchema.safeParse({ ...required, bodyType: "Sedan", seats: "7" }).success).toBe(false);
    expect(recommendationPreferencesSchema.safeParse({ ...base, bodyType: "Sedan", seats: "5" }).success).toBe(true);
  });
});
