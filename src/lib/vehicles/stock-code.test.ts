import { describe, expect, it } from "vitest";

import { nextStockCode } from "./stock-code";

describe("nextStockCode", () => {
  it("follows the highest GCE code", () => {
    expect(nextStockCode(["GCE-001", "GCE-002"])).toBe("GCE-003");
    expect(nextStockCode(["GCE-010", "GCE-002"])).toBe("GCE-011");
  });

  it("starts at GCE-001 and skips codes outside the pattern", () => {
    expect(nextStockCode([])).toBe("GCE-001");
    expect(nextStockCode(["STK-9", null, "gce-004 ", "GCE-x"])).toBe("GCE-005");
  });

  it("grows past three digits", () => {
    expect(nextStockCode(["GCE-999"])).toBe("GCE-1000");
  });
});
