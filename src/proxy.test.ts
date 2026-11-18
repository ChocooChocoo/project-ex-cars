// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveInternalPath } from "@/lib/routing/paths";

const { NextRequest } = await import("next/server");
const { proxy } = await import("./proxy");

// Phase 3: Laravel owns the session. The proxy only routes; it never reads, refreshes or writes the
// Laravel session cookie, and the `gce-role` cookie is a routing hint, not a permission.
const SESSION_COOKIE = "gce_session";

function renderRequest(pathname: string, role = "ceo") {
  return new NextRequest(`https://app.test${pathname}`, {
    headers: { cookie: `${SESSION_COOKIE}=laravel-session; gce-role=${role}` },
  });
}

function sessionCookies(response: Response): string[] {
  return response.headers.getSetCookie().filter((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
}

describe("proxy routes by the role hint and leaves the Laravel session alone", () => {
  it("rewrites a role-prefixed path internally without touching cookies", async () => {
    const request = renderRequest("/ceo/dashboard");

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `https://app.test${resolveInternalPath("ceo", "dashboard")}`,
    );
    expect(request.cookies.get(SESSION_COOKIE)?.value).toBe("laravel-session");
    expect(sessionCookies(response)).toHaveLength(0);
  });

  it("passes the session cookie through to the render unchanged", async () => {
    const response = await proxy(renderRequest("/ceo/roles/"));

    expect(response.headers.get("x-middleware-request-cookie")).toContain("gce-role=ceo");
    expect(response.headers.get("x-middleware-request-cookie")).toContain(`${SESSION_COOKIE}=laravel-session`);
  });

  it("still redirects a legacy /dashboard path", async () => {
    const response = await proxy(renderRequest("/dashboard/roles"));

    expect(response.headers.get("location")).toBe("https://app.test/ceo/roles");
    expect(sessionCookies(response)).toHaveLength(0);
  });

  it("sends a visitor with no role hint to login", async () => {
    const response = await proxy(new NextRequest("https://app.test/ceo/dashboard"));

    expect(response.headers.get("location")).toBe("https://app.test/auth/v1/login");
  });

  it("moves a mismatched role prefix to the hinted role (presentation only; Laravel still authorises)", async () => {
    const response = await proxy(renderRequest("/ceo/dashboard", "mechanic"));

    expect(response.headers.get("location")).toBe("https://app.test/mechanic/dashboard");
  });

  // T04 L1: signed-out visitors see the public landing page at /.
  it("serves the landing page at / to a visitor with no role", async () => {
    const response = await proxy(new NextRequest("https://app.test/"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("still sends a signed-in user from / to their landing path", async () => {
    const response = await proxy(renderRequest("/", "customer"));

    expect(response.headers.get("location")).toBe("https://app.test/customer/showroom");
  });

  it("leaves the skipped prefixes alone", async () => {
    for (const pathname of ["/auth/v1/login", "/template/landing", "/api/health", "/_next/static/chunk.js"]) {
      const response = await proxy(renderRequest(pathname));

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(sessionCookies(response)).toHaveLength(0);
    }
  });
});

// Shared showroom links resolve to customer pages, whose layout denies staff access.
describe("staff showroom routing", () => {
  it("leaves shared showroom lists on the customer route", async () => {
    const response = await proxy(renderRequest("/marketing_specialist/showroom", "marketing_specialist"));

    expect(response.headers.get("x-middleware-rewrite")).toBe("https://app.test/showroom");
  });

  it("sends a single car to the customer showroom page", async () => {
    const response = await proxy(renderRequest("/marketing_specialist/showroom/v-1", "marketing_specialist"));

    expect(response.headers.get("x-middleware-rewrite")).toBe("https://app.test/showroom/v-1");
  });
});
