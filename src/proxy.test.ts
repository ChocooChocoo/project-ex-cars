// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveInternalPath } from "@/lib/routing/paths";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://testproj.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";

const SESSION_COOKIE = "sb-testproj-auth-token";
const STALE = "stale-session-value";
const ROTATED = "rotated-session-value";

const sdk = vi.hoisted(() => ({
  rotatedSets: [] as { name: string; value: string; options?: Record<string, unknown> }[],
}));

// Stands in for @supabase/ssr: getUser() persists a rotated token through the same cookie
// adapter the real SDK uses when it refreshes an expiring session.
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (cookies: { name: string; value: string }[]) => void } },
  ) => ({
    auth: {
      async getUser() {
        for (const cookie of sdk.rotatedSets) {
          options.cookies.setAll([cookie]);
        }
        return { data: { user: { id: "00000000-0000-4000-8000-000000000000" } }, error: null };
      },
    },
  }),
}));

const { NextRequest } = await import("next/server");
const { proxy } = await import("./proxy");

function renderRequest(pathname: string, role = "ceo") {
  return new NextRequest(`https://app.test${pathname}`, {
    headers: { cookie: `${SESSION_COOKIE}=${STALE}; gce-role=${role}` },
  });
}

function sessionCookies(response: Response): string[] {
  return response.headers.getSetCookie().filter((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
}

beforeEach(() => {
  sdk.rotatedSets = [{ name: SESSION_COOKIE, value: ROTATED, options: { path: "/" } }];
});

describe("proxy refreshes the session for the render it is about to make", () => {
  it("gives the downstream render the rotated token, not the spent one", async () => {
    const request = renderRequest("/ceo/dashboard");

    const response = await proxy(request);

    // 1. The forwarded request carries the refreshed session, so the Server Component
    //    render for this same request no longer reads pre-refresh cookies.
    expect(request.cookies.get(SESSION_COOKIE)?.value).toBe(ROTATED);
    expect(response.headers.get("x-middleware-request-cookie")).toContain(`${SESSION_COOKIE}=${ROTATED}`);
    expect(response.headers.get("x-middleware-request-cookie")).not.toContain(STALE);

    // 2. The response still stores the rotated cookie in the browser.
    expect(sessionCookies(response)).toHaveLength(1);
    expect(sessionCookies(response)[0]).toContain(ROTATED);

    // 3. Routing is untouched: the role-prefixed path still rewrites internally.
    const expectedRewrite = `https://app.test${resolveInternalPath("ceo", "dashboard")}`;
    expect(response.headers.get("x-middleware-rewrite")).toBe(expectedRewrite);
  });

  it("keeps the role cookie and routing behaviour identical on a pass-through request", async () => {
    const request = renderRequest("/ceo/roles/");

    const response = await proxy(request);

    expect(request.cookies.get("gce-role")?.value).toBe("ceo");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("gce-role=ceo");
    expect(response.headers.get("x-middleware-request-cookie")).toContain(`${SESSION_COOKIE}=${ROTATED}`);
  });

  it("still redirects a legacy /dashboard path and still sets the session cookie", async () => {
    const request = renderRequest("/dashboard/roles");

    const response = await proxy(request);

    expect(response.headers.get("location")).toBe("https://app.test/ceo/roles");
    expect(sessionCookies(response)).toHaveLength(1);
    expect(sessionCookies(response)[0]).toContain(ROTATED);
  });

  it("still sends an unknown visitor with no role to login", async () => {
    const request = new NextRequest("https://app.test/ceo/dashboard");

    const response = await proxy(request);

    expect(response.headers.get("location")).toBe("https://app.test/auth/v1/login");
    expect(sessionCookies(response)).toHaveLength(1);
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
      const request = renderRequest(pathname);
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(request.cookies.get(SESSION_COOKIE)?.value).toBe(STALE);
      expect(sessionCookies(response)).toHaveLength(0);
    }
  });
});

// Phase 6: every "showroom..." segment used to rewrite to /staff-showroom, which has no [id]
// page, so a staff role opening a car from a shared link got a 404.
describe("staff showroom routing", () => {
  it("sends the showroom list to the staff showroom", async () => {
    const response = await proxy(renderRequest("/marketing_specialist/showroom", "marketing_specialist"));

    expect(response.headers.get("x-middleware-rewrite")).toBe("https://app.test/staff-showroom");
  });

  it("sends a single car to the customer showroom page", async () => {
    const response = await proxy(renderRequest("/marketing_specialist/showroom/v-1", "marketing_specialist"));

    expect(response.headers.get("x-middleware-rewrite")).toBe("https://app.test/showroom/v-1");
  });
});
