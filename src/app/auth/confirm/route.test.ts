import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyOtp, getUser, rpc } = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { verifyOtp, getUser }, rpc })),
}));

import { GET } from "./route";

function call(query: string) {
  return GET(new Request(`https://gce.example/auth/confirm?${query}`) as never);
}

describe("auth confirmation link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyOtp.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockResolvedValue({ data: [{ account_id: "u1", role: "customer" }] });
  });

  it("verifies the token hash and sets the role cookie", async () => {
    const response = await call("token_hash=abc&type=signup&next=%2Fcustomer%2Fshowroom");
    expect(response.headers.get("location")).toBe("https://gce.example/customer/showroom");
    expect(response.cookies.get("gce-role")?.value).toBe("customer");
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "signup" });
  });

  it("falls back to the role landing page", async () => {
    const response = await call("token_hash=abc&type=signup");
    expect(response.headers.get("location")).toBe("https://gce.example/customer/showroom");
  });

  it("rejects a missing or expired token", async () => {
    const missing = await call("type=signup");
    expect(missing.headers.get("location")).toBe("https://gce.example/auth/v1/login?error=confirmation_failed");

    verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const expired = await call("token_hash=abc&type=signup");
    expect(expired.headers.get("location")).toBe("https://gce.example/auth/v1/login?error=confirmation_failed");
  });

  it("passes a Supabase error code to the login notice", async () => {
    const response = await call("error_code=otp_expired");
    expect(response.headers.get("location")).toBe("https://gce.example/auth/v1/login?error=otp_expired");
  });
});
