import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeAction, apiWrite } = vi.hoisted(() => ({ authorizeAction: vi.fn(), apiWrite: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/action-guard", () => ({ authorizeAction }));
vi.mock("@/lib/api/server", () => ({ apiWrite, relaySetCookies: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

import { ApiError } from "@/lib/api/errors";

import { requestEmailChange } from "./actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

// Laravel emails a signed link to the new address that returns to /customer/profile (backend SessionTest).
describe("customer email change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAction.mockResolvedValue({ ok: true, data: { userId: "u1", role: "customer" } });
    apiWrite.mockResolvedValue({ status: 200, data: { ok: true, email: "new@example.com" }, setCookies: [] });
  });

  it("asks Laravel to email the new address, normalised", async () => {
    expect(await requestEmailChange(form({ email: " New@Example.com " }))).toEqual({
      success: true,
      email: "new@example.com",
    });
    expect(authorizeAction).toHaveBeenCalledWith(["customer"]);
    expect(apiWrite).toHaveBeenCalledWith("POST", "/api/v1/me/email", { email: "new@example.com" });
  });

  it("refuses staff without calling Laravel", async () => {
    authorizeAction.mockResolvedValue({ ok: false, message: "You do not have permission for this action." });
    expect(await requestEmailChange(form({ email: "new@example.com" }))).toEqual({
      error: "You do not have permission for this action.",
    });
    expect(apiWrite).not.toHaveBeenCalled();
  });

  it.each([
    [
      new ApiError(422, { code: "validation_error", message: "This is already your email." }),
      "This is already your email.",
    ],
    [
      new ApiError(422, { code: "validation_error", message: "This email is already used by another account." }),
      "This email is already used by another account.",
    ],
    [
      new ApiError(429, { code: "rate_limited", message: "x" }),
      "Too many emails sent. Please wait a few minutes and try again.",
    ],
    [new ApiError(500, { code: "http_error", message: "x" }), "We could not send the email. Please try again."],
  ])("maps Laravel errors to plain messages", async (error, message) => {
    apiWrite.mockRejectedValue(error);
    expect(await requestEmailChange(form({ email: "new@example.com" }))).toEqual({ error: message });
  });
});
