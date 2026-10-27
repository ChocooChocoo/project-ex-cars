import { beforeEach, describe, expect, it, vi } from "vitest";

const { authSignUp, cookieSet, redirect, revalidatePath, createAdminClient } = vi.hoisted(() => ({
  authSignUp: vi.fn(),
  cookieSet: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSet })),
  headers: vi.fn(async () => new Headers({ origin: "https://gce.example" })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { signUp: authSignUp } })),
}));

import { signUp } from "./actions";

function form(overrides: Record<string, string | null> = {}) {
  const values: Record<string, string | null> = {
    email: "new@example.com",
    password: "Correct-horse-9",
    full_name: "Juan Dela Cruz",
    accept_terms: "true",
    accept_policy: "true",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== null) data.set(key, value);
  return data;
}

const user = { id: "u1", identities: [{ id: "i1" }] };

describe("signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks the user to check their email when no session comes back", async () => {
    authSignUp.mockResolvedValue({ data: { user, session: null }, error: null });

    await expect(signUp(form())).resolves.toEqual({ notice: "Check your email to verify your account." });
    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("sends the verification link to the callback and stores the policy acceptance", async () => {
    authSignUp.mockResolvedValue({ data: { user, session: null }, error: null });

    await signUp(form());
    const options = authSignUp.mock.calls[0]?.[0].options;
    expect(options.emailRedirectTo).toBe("https://gce.example/auth/callback");
    expect(options.data.full_name).toBe("Juan Dela Cruz");
    expect(typeof options.data.terms_accepted_at).toBe("string");
  });

  it("treats empty identities as an already registered email", async () => {
    authSignUp.mockResolvedValue({ data: { user: { id: "u1", identities: [] }, session: null }, error: null });

    await expect(signUp(form())).resolves.toEqual({
      error: "This email is already registered. Please log in instead.",
    });
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it.each([
    ["accept_terms", { accept_terms: null }],
    ["accept_policy", { accept_policy: "false" }],
  ])("refuses registration when %s is not checked", async (_name, overrides) => {
    await expect(signUp(form(overrides))).resolves.toEqual({
      error: "You must agree to the Terms and Conditions and the Company Policy.",
    });
    expect(authSignUp).not.toHaveBeenCalled();
  });

  it("signs the customer in when confirmations are off", async () => {
    authSignUp.mockResolvedValue({ data: { user, session: { access_token: "t" } }, error: null });

    await signUp(form());
    expect(cookieSet).toHaveBeenCalledWith("gce-role", "customer", expect.objectContaining({ httpOnly: true }));
    expect(redirect).toHaveBeenCalledWith("/customer/showroom");
  });
});
