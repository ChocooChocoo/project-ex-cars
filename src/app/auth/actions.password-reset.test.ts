import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiWrite, redirect } = vi.hoisted(() => ({
  apiWrite: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/api/server", () => ({ apiWrite, relaySetCookies: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

import { ApiError } from "@/lib/api/errors";

import { requestPasswordReset, resetPassword } from "./actions";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("requestPasswordReset", () => {
  it("asks Laravel for a link and shows its neutral notice", async () => {
    apiWrite.mockResolvedValue({
      status: 202,
      data: { notice: "If an account uses that email, we sent a reset link." },
      setCookies: [],
    });
    expect(await requestPasswordReset(form({ email: " Buyer@Example.com " }))).toEqual({
      notice: "If an account uses that email, we sent a reset link.",
    });
    expect(apiWrite).toHaveBeenCalledWith("POST", "/api/v1/auth/password/forgot", { email: "buyer@example.com" });
  });

  it("rejects a bad email before any request and explains rate limits", async () => {
    expect(await requestPasswordReset(form({ email: "nope" }))).toHaveProperty("error");
    expect(apiWrite).not.toHaveBeenCalled();
    apiWrite.mockRejectedValue(new ApiError(429, { code: "rate_limited", message: "x" }));
    expect(await requestPasswordReset(form({ email: "a@b.co" }))).toEqual({
      error: "Too many emails sent. Please wait a few minutes and try again.",
    });
  });
});

describe("resetPassword", () => {
  const valid = { token: "tok", email: "buyer@example.com", password: "Brand#New1", confirm_password: "Brand#New1" };

  it("sets the new password through Laravel, then sends the user to log in", async () => {
    apiWrite.mockResolvedValue({ status: 200, data: {}, setCookies: [] });
    await expect(resetPassword(form(valid))).rejects.toThrow("NEXT_REDIRECT /auth/v1/login?notice=password_reset");
    expect(apiWrite).toHaveBeenCalledWith("POST", "/api/v1/auth/password/reset", {
      token: "tok",
      email: "buyer@example.com",
      password: "Brand#New1",
    });
  });

  it("refuses weak or mismatched passwords before any request", async () => {
    expect(await resetPassword(form({ ...valid, confirm_password: "Other#123" }))).toEqual({
      error: "The new passwords do not match.",
    });
    expect(await resetPassword(form({ ...valid, password: "abcdefgh", confirm_password: "abcdefgh" }))).toEqual({
      error: "Add an uppercase letter.",
    });
    expect(apiWrite).not.toHaveBeenCalled();
  });

  it("shows Laravel's message for an expired link", async () => {
    apiWrite.mockRejectedValue(
      new ApiError(422, { code: "invalid_link", message: "This reset link is invalid or has expired." }),
    );
    expect(await resetPassword(form(valid))).toEqual({ error: "This reset link is invalid or has expired." });
  });
});
