import { afterEach, describe, expect, it, vi } from "vitest";

import { judgeIdText, judgeOrcrText, type VerificationProvider, verifyDocument } from "./verify-document";

const file = { path: "tx/orcr-1.jpg" };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyDocument", () => {
  it("falls back to manual review when no provider is set", async () => {
    vi.stubEnv("ORCR_VERIFY_PROVIDER", "");
    await expect(verifyDocument("orcr", file)).resolves.toMatchObject({ status: "manual_review", provider: null });
  });

  it("falls back to manual review when the provider throws", async () => {
    vi.stubEnv("ID_VERIFY_PROVIDER", "stub");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const stub: VerificationProvider = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(verifyDocument("valid_id", file, { stub })).resolves.toMatchObject({
      status: "manual_review",
      provider: "stub",
    });
  });

  it("falls back to manual review for an unknown provider name", async () => {
    vi.stubEnv("ORCR_VERIFY_PROVIDER", "nobody");
    await expect(verifyDocument("orcr", file, {})).resolves.toMatchObject({ status: "manual_review" });
  });

  it("passes the provider result through with its key", async () => {
    vi.stubEnv("ID_VERIFY_PROVIDER", "stub");
    vi.stubEnv("ID_VERIFY_API_KEY", "secret");
    const stub = vi.fn<VerificationProvider>().mockResolvedValue({ status: "failed", detail: "Name mismatch" });
    await expect(verifyDocument("valid_id", { ...file, idType: "passport" }, { stub })).resolves.toEqual({
      status: "failed",
      provider: "stub",
      detail: "Name mismatch",
    });
    expect(stub).toHaveBeenCalledWith({ kind: "valid_id", path: file.path, idType: "passport", apiKey: "secret" });
  });
});

describe("judgeOrcrText", () => {
  it("accepts text with OR/CR markers", () => {
    const text =
      "Republic of the Philippines Land Transportation Office Certificate of Registration Plate No. ABC 1234";
    expect(judgeOrcrText(text).status).toBe("verified");
  });

  it("rejects text that is not an OR/CR", () => {
    expect(judgeOrcrText("Grocery receipt Rice 50.00").status).toBe("failed");
  });
});

describe("judgeIdText", () => {
  it("accepts a driver's license read as that type", () => {
    expect(
      judgeIdText("Republic of the Philippines Land Transportation Office Driver's License", "drivers_license").status,
    ).toBe("verified");
  });

  it("rejects an ID that does not match the chosen type", () => {
    expect(judgeIdText("Republic of the Philippines PhilHealth", "passport").status).toBe("failed");
  });
});
