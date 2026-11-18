import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiWrite, relaySetCookies, cookieSet, cookieDelete, redirect } = vi.hoisted(() => ({
  apiWrite: vi.fn(),
  relaySetCookies: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: cookieSet, delete: cookieDelete })) }));
vi.mock("@/lib/api/server", () => ({ apiWrite, relaySetCookies }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

import { ApiError } from "@/lib/api/errors";

import { signIn, signOut, signUp } from "./actions";

function form(values: Record<string, string | null>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== null) data.set(key, value);
  return data;
}

const signup = (overrides: Record<string, string | null> = {}) =>
  form({
    email: "new@example.com",
    password: "Correct-horse-9",
    full_name: "Juan Dela Cruz",
    accept_terms: "true",
    accept_policy: "true",
    ...overrides,
  });

beforeEach(() => vi.clearAllMocks());

describe("signUp", () => {
  it("registers through Laravel and asks the user to check their email (no session until verified)", async () => {
    apiWrite.mockResolvedValue({
      status: 201,
      data: { notice: "Check your email to verify your account." },
      setCookies: [],
    });

    await expect(signUp(signup())).resolves.toEqual({ notice: "Check your email to verify your account." });
    expect(apiWrite).toHaveBeenCalledWith("POST", "/api/v1/auth/register", {
      email: "new@example.com",
      password: "Correct-horse-9",
      full_name: "Juan Dela Cruz",
      accept_terms: true,
      accept_policy: true,
    });
    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("shows Laravel's message for an already registered email", async () => {
    apiWrite.mockRejectedValue(
      new ApiError(422, {
        code: "validation_error",
        message: "This email is already registered. Please log in instead.",
      }),
    );
    await expect(signUp(signup())).resolves.toEqual({
      error: "This email is already registered. Please log in instead.",
    });
  });

  it.each([
    ["accept_terms", { accept_terms: null }],
    ["accept_policy", { accept_policy: "false" }],
  ])("refuses registration when %s is not checked", async (_name, overrides) => {
    await expect(signUp(signup(overrides))).resolves.toEqual({
      error: "You must agree to the Terms and Conditions and the Company Policy.",
    });
    expect(apiWrite).not.toHaveBeenCalled();
  });

  it("refuses a weak password before calling Laravel", async () => {
    await expect(signUp(signup({ password: "abcdefgh" }))).resolves.toEqual({ error: "Add an uppercase letter." });
    expect(apiWrite).not.toHaveBeenCalled();
  });
});

describe("signIn", () => {
  const me = { id: "u1", email: "ceo@gce.local", email_verified: true, role: "ceo", profile: {} };

  it("relays Laravel's session cookies, sets the role hint and lands on the role's page", async () => {
    apiWrite.mockResolvedValue({ status: 200, data: me, setCookies: ["gce_session=abc; path=/; httponly"] });

    await expect(signIn(form({ email: "ceo@gce.local", password: "Secret#123", remember: "on" }))).rejects.toThrow(
      "NEXT_REDIRECT /ceo/dashboard",
    );
    expect(apiWrite).toHaveBeenCalledWith("POST", "/api/v1/auth/login", {
      email: "ceo@gce.local",
      password: "Secret#123",
      remember: true,
    });
    expect(relaySetCookies).toHaveBeenCalledWith(["gce_session=abc; path=/; httponly"]);
    expect(cookieSet).toHaveBeenCalledWith("gce-role", "ceo", expect.objectContaining({ httpOnly: true }));
  });

  it("shows Laravel's wording for bad credentials and unverified emails", async () => {
    apiWrite.mockRejectedValueOnce(
      new ApiError(422, { code: "invalid_credentials", message: "Invalid login credentials" }),
    );
    expect(await signIn(form({ email: "a@b.co", password: "Secret#123" }))).toEqual({
      error: "Invalid login credentials",
    });
    apiWrite.mockRejectedValueOnce(new ApiError(403, { code: "email_not_verified", message: "Email not confirmed" }));
    expect(await signIn(form({ email: "a@b.co", password: "Secret#123" }))).toEqual({ error: "Email not confirmed" });
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("keeps an API outage distinct from a credential failure", async () => {
    apiWrite.mockRejectedValue(new ApiError(0, {}));
    expect(((await signIn(form({ email: "a@b.co", password: "Secret#123" }))) as { error: string }).error).toMatch(
      /not reachable/,
    );
  });
});

describe("signOut", () => {
  it("ends the Laravel session and clears this browser's cookies even if Laravel is down", async () => {
    apiWrite.mockRejectedValue(new ApiError(0, {}));
    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT /auth/v1/login");
    expect(apiWrite).toHaveBeenCalledWith("POST", "/api/v1/auth/logout");
    expect(cookieDelete).toHaveBeenCalledWith("gce-role");
    expect(cookieDelete).toHaveBeenCalledWith("gce_session");
  });
});
