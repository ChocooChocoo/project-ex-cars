import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiGet, relaySetCookies } = vi.hoisted(() => ({ apiGet: vi.fn(), relaySetCookies: vi.fn() }));

vi.mock("@/lib/api/server", () => ({ apiGet, relaySetCookies }));

import { ApiError } from "@/lib/api/errors";

import { GET } from "./route";

const VERIFY =
  "/api/v1/auth/email/verify/9f1c2d3e-0000-4000-8000-000000000001/" +
  "a".repeat(40) +
  "?expires=1&signature=" +
  "b".repeat(64);
const CHANGE =
  "/api/v1/auth/email/change/9f1c2d3e-0000-4000-8000-000000000001?email=new%40x.co&expires=1&signature=" +
  "c".repeat(64);

function call(query: Record<string, string>) {
  return GET(new Request(`https://gce.example/auth/confirm?${new URLSearchParams(query)}`) as never);
}

describe("auth confirmation link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockResolvedValue({
      status: 200,
      data: { id: "u1", role: "customer" },
      setCookies: ["gce_session=s; path=/"],
    });
  });

  it("relays Laravel's signed verification, its session cookie and the role hint", async () => {
    const response = await call({ verify: VERIFY });
    expect(apiGet).toHaveBeenCalledWith(VERIFY);
    expect(relaySetCookies).toHaveBeenCalledWith(["gce_session=s; path=/"]);
    expect(response.headers.get("location")).toBe("https://gce.example/customer/showroom");
    expect(response.cookies.get("gce-role")?.value).toBe("customer");
  });

  it("returns an email change to the same-site page in next, never off-site", async () => {
    expect((await call({ verify: CHANGE, next: "/customer/profile" })).headers.get("location")).toBe(
      "https://gce.example/customer/profile",
    );
    expect((await call({ verify: CHANGE, next: "//evil.example" })).headers.get("location")).toBe(
      "https://gce.example/customer/showroom",
    );
  });

  it("refuses anything that is not a Laravel signed email path, without calling the API", async () => {
    for (const verify of [
      "",
      "/api/v1/me",
      "https://evil.example/api/v1/auth/email/verify/x/y?signature=1",
      "/api/v1/auth/email/verify/x/short?signature=1",
    ]) {
      const response = await call(verify ? { verify } : {});
      expect(response.headers.get("location")).toBe("https://gce.example/auth/v1/login?error=confirmation_failed");
    }
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("explains an expired/invalid link and a taken email", async () => {
    apiGet.mockRejectedValueOnce(new ApiError(403, { code: "invalid_signature" }));
    expect((await call({ verify: VERIFY })).headers.get("location")).toBe(
      "https://gce.example/auth/v1/login?error=confirmation_failed",
    );
    apiGet.mockRejectedValueOnce(new ApiError(409, { code: "conflict" }));
    expect((await call({ verify: CHANGE })).headers.get("location")).toBe(
      "https://gce.example/auth/v1/login?error=email_taken",
    );
  });
});
