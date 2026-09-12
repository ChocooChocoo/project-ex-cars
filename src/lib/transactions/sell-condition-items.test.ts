import { describe, expect, it } from "vitest";

import { getConditionItemIds, resolveConditionItemLabels } from "./sell-condition-items";

const exteriorId = "11111111-1111-4111-8111-111111111111";
const brakesId = "22222222-2222-4222-8222-222222222222";

describe("sell submission condition items", () => {
  it("reads UUIDs from JSON arrays and serialized arrays for lookup", () => {
    expect(getConditionItemIds([exteriorId, "Customer note", null])).toEqual([exteriorId]);
    expect(getConditionItemIds(JSON.stringify([brakesId]))).toEqual([brakesId]);
    expect(getConditionItemIds(null)).toEqual([]);
  });

  it("uses resolved node names and retains non-empty raw text only as fallback", () => {
    expect(
      resolveConditionItemLabels([exteriorId, brakesId, "Customer noted vibration", ""], {
        [exteriorId]: "Exterior scratches",
        [brakesId]: "Brake wear",
      }),
    ).toEqual(["Exterior scratches", "Brake wear", "Customer noted vibration"]);
    expect(resolveConditionItemLabels(JSON.stringify([exteriorId]), { [exteriorId]: "Exterior scratches" })).toEqual([
      "Exterior scratches",
    ]);
    expect(resolveConditionItemLabels("Customer noted vibration", {})).toEqual(["Customer noted vibration"]);
    expect(resolveConditionItemLabels(JSON.stringify(brakesId), {})).toEqual([brakesId]);
    expect(resolveConditionItemLabels(null, {})).toEqual([]);
  });
});
