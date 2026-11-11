import { describe, expect, it } from "vitest";

import { deriveSellStages } from "./transaction-overview-v1";

const doc = (document_kind: string, verification_state = "verified") => ({ document_kind, verification_state });

describe("deriveSellStages (T10)", () => {
  it("names the Marketing Specialist, the CEO and the Head Accountant, never the Sales Manager", () => {
    const stages = deriveSellStages("pending", []);
    expect(stages.map((stage) => `${stage.label} – ${stage.owner}`)).toEqual([
      "Processed – Marketing Specialist",
      "Verified – Marketing Specialist",
      "Ceiling approved – CEO",
      "Bought and paid – Head Accountant",
    ]);
    expect(stages[0].status).toBe("current");
  });

  it("marks steps done as the offer moves on", () => {
    expect(deriveSellStages("pending", [doc("orcr", "rejected")])[0].status).toBe("done");
    expect(deriveSellStages("approved", []).map((stage) => stage.status)).toEqual(["done", "done", "done", "current"]);
  });
});
