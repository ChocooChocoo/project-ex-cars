import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiWrite } = vi.hoisted(() => ({ apiWrite: vi.fn() }));

vi.mock("@/lib/api/revalidate", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/client", () => ({
  browserApi: (...args: unknown[]) => {
    while (args.length > 0 && args[args.length - 1] === undefined) args.pop();
    return Promise.resolve(apiWrite(...args)).then((result: { data?: unknown } | undefined) => result?.data);
  },
}));

import { ApiError } from "@/lib/api/errors";

import { resendVerificationEmail } from "./actions";

beforeEach(() => vi.clearAllMocks());

describe("resendVerificationEmail", () => {
  it("asks Laravel for a new link and shows its neutral notice", async () => {
    apiWrite.mockResolvedValue({ data: { notice: "If that account needs verifying, we sent a new link." } });
    expect(await resendVerificationEmail(" New@Example.com ")).toEqual({
      notice: "If that account needs verifying, we sent a new link.",
    });
    expect(apiWrite).toHaveBeenCalledWith("POST", "/api/v1/auth/email/resend", { email: "new@example.com" });
  });

  it("rejects a bad email before any request and explains rate limits", async () => {
    expect(await resendVerificationEmail("nope")).toHaveProperty("error");
    expect(apiWrite).not.toHaveBeenCalled();
    apiWrite.mockRejectedValue(new ApiError(429, { code: "rate_limited", message: "x" }));
    expect(await resendVerificationEmail("a@b.co")).toEqual({
      error: "Too many emails sent. Please wait a few minutes and try again.",
    });
  });
});
