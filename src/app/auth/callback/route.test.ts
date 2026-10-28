import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, getUser, rpc } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { exchangeCodeForSession, getUser }, rpc })),
}));

import { GET } from "./route";

function call(query: string) {
  return GET(new Request(`https://gce.example/auth/callback?${query}`) as never);
}

describe("auth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockResolvedValue({ data: [{ account_id: "u1", role: "customer" }] });
  });

  it("returns to the same-site page in next", async () => {
    const response = await call("code=c&next=%2Fcustomer%2Fprofile");
    expect(response.headers.get("location")).toBe("https://gce.example/customer/profile");
  });

  it.each(["https%3A%2F%2Fevil.example", "%2F%2Fevil.example"])("ignores an off-site next (%s)", async (next) => {
    const response = await call(`code=c&next=${next}`);
    expect(response.headers.get("location")).toBe("https://gce.example/customer/showroom");
  });

  it("asks for a fresh sign-in when an email-change link is opened in another browser", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "code verifier missing" } });
    const response = await call("code=c&next=%2Fcustomer%2Fprofile");
    expect(response.headers.get("location")).toBe("https://gce.example/auth/v1/login?notice=email_confirmed");
  });

  it("keeps the generic error for other failed sign-ins", async () => {
    const response = await call("");
    expect(response.headers.get("location")).toBe("https://gce.example/auth/v1/login?error=auth_callback_failed");
  });
});
