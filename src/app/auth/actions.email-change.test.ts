import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeAction, updateUser } = vi.hoisted(() => ({
  authorizeAction: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(async () => new Headers({ origin: "https://gce.example" })),
}));
vi.mock("@/lib/auth/action-guard", () => ({ authorizeAction }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(),
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "buyer@example.com" } } })),
      updateUser,
    },
  })),
}));

import { requestEmailChange } from "./actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("customer email change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAction.mockResolvedValue({ ok: true, data: { userId: "u1", role: "customer" } });
    updateUser.mockResolvedValue({ error: null });
  });

  it("emails a confirmation link that returns to the profile", async () => {
    expect(await requestEmailChange(form({ email: " New@Example.com " }))).toEqual({
      success: true,
      email: "new@example.com",
    });
    expect(authorizeAction).toHaveBeenCalledWith(["customer"]);
    expect(updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      { emailRedirectTo: "https://gce.example/auth/callback?next=%2Fcustomer%2Fprofile" },
    );
  });

  it("refuses staff", async () => {
    authorizeAction.mockResolvedValue({ ok: false, message: "You do not have permission for this action." });

    expect(await requestEmailChange(form({ email: "new@example.com" }))).toEqual({
      error: "You do not have permission for this action.",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses the current email", async () => {
    expect(await requestEmailChange(form({ email: "Buyer@example.com" }))).toEqual({
      error: "This is already your email.",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "email_exists", status: 422, message: "x" }, "This email is already used by another account."],
    [
      { code: "over_email_send_rate_limit", status: 429, message: "x" },
      "Too many emails sent. Please wait a few minutes and try again.",
    ],
  ])("maps Supabase errors to plain messages", async (error, message) => {
    updateUser.mockResolvedValue({ error });
    expect(await requestEmailChange(form({ email: "new@example.com" }))).toEqual({ error: message });
  });
});
