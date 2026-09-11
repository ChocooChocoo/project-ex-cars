import { beforeEach, describe, expect, it, vi } from "vitest";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const URL_BASE = "https://testproj.supabase.co";
const STORAGE_KEY = "sb-testproj-auth-token";

process.env.NEXT_PUBLIC_SUPABASE_URL = URL_BASE;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";

// Mirrors src/lib/supabase/server.ts's cookie wiring, but records writes and throws the
// way Next.js does during a Server Component render.
const state = {
  cookieJar: [] as { name: string; value: string }[],
  writeAttempts: 0,
};

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => state.cookieJar,
    set: () => {
      state.writeAttempts += 1;
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    },
  }),
}));

const { createServerSupabase } = await import("./server");
const { getNotifications, getUnreadNotificationCount } = await import("@/lib/notifications/actions");

// A session whose access token is already expired, so the SDK takes the refresh path.
function expiredSessionCookie() {
  return JSON.stringify({
    access_token: "header.payload.signature",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) - 600,
    refresh_token: "stale-refresh-token",
    user: { id: "00000000-0000-4000-8000-000000000000", aud: "authenticated" },
  });
}

beforeEach(() => {
  state.writeAttempts = 0;
  state.cookieJar = [{ name: STORAGE_KEY, value: expiredSessionCookie() }];

  // Offline stub: the refresh token is rejected, which is the returning-user case —
  // the SDK then clears the dead session and tries to persist that clearing.
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "invalid_grant", error_description: "Invalid Refresh Token" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
});

describe("server Supabase clients and expired sessions", () => {
  it("read-only client survives an expired session without attempting a cookie write", async () => {
    const supabase = await createServerSupabase();

    await expect(supabase.auth.getUser()).resolves.toBeDefined();
    expect(state.writeAttempts).toBe(0);
  });

  it("read-write client is the one that writes cookies, which is the hazard", () => {
    // Asserted from source rather than by driving a live refresh: the SDK holds a
    // 60s refresh-failure cooldown and a cross-instance lock, so the behavioral
    // version is slow and order-dependent while this is exact.
    const server = readFileSync(resolve(process.cwd(), "src/lib/supabase/server.ts"), "utf8");
    const readOnly = server.slice(server.indexOf("export async function createServerSupabase("));
    const readWrite = readOnly.slice(readOnly.indexOf("export async function createServerSupabaseClient("));

    // The read-only client's setAll must stay a no-op: it runs during renders.
    const readOnlySetAll = readOnly.slice(readOnly.indexOf("setAll()"), readOnly.indexOf("createServerSupabaseClient"));
    expect(readOnlySetAll).not.toContain("cookieStore.set(");

    // The read-write client is the one that calls cookieStore.set, which Next.js
    // rejects outright during a Server Component render.
    expect(readWrite).toContain("cookieStore.set(name, value, options)");
  });

  it("treats a valid session as needing no cookie write", async () => {
    state.cookieJar = [
      {
        name: STORAGE_KEY,
        value: JSON.stringify({
          access_token: "header.payload.signature",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "fresh-refresh-token",
          user: { id: "00000000-0000-4000-8000-000000000000", aud: "authenticated" },
        }),
      },
    ];

    const supabase = await createServerSupabase();
    await expect(supabase.auth.getUser()).resolves.toBeDefined();
    expect(state.writeAttempts).toBe(0);
  });

  it("notification reads awaited during a layout render survive an expired session", async () => {
    // The list is empty by design: this asserts the read path never reaches for a cookie
    // write, not what the rows happen to be.
    const emptyList = vi.fn(
      async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const authFailure = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "invalid_grant", error_description: "Invalid Refresh Token" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/auth/v1/token") ? authFailure() : emptyList(),
      ),
    );

    // Awaited inside src/app/(staff)/layout.tsx and the customer/supplier layouts, so a
    // cookie write here is a 500 on every page in those groups.
    await expect(getNotifications("ceo")).resolves.toEqual([]);
    await expect(getUnreadNotificationCount("ceo")).resolves.toBe(0);
    expect(state.writeAttempts).toBe(0);
  });
});

describe("render-path wiring", () => {
  const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

  it("getCurrentRole uses the read-only client so a render can never write cookies", () => {
    const actions = read("src/app/auth/actions.ts");
    const body = actions.slice(actions.indexOf("export async function getCurrentRole"));

    expect(body).toContain("await createServerSupabase()");
    expect(body.slice(0, body.indexOf("export async function ", 10))).not.toContain(
      "await createServerSupabaseClient()",
    );
  });

  it("getCurrentUser uses the read-only client, since the suppliers page renders it", () => {
    const actions = read("src/app/auth/actions.ts");
    const body = actions.slice(actions.indexOf("export async function getCurrentUser"));

    expect(body).toContain("await createServerSupabase()");
    expect(body.slice(0, body.indexOf("export async function ", 10))).not.toContain(
      "await createServerSupabaseClient()",
    );
  });

  it("ships a proxy that refreshes the session, since middleware is deprecated in Next 16", () => {
    const proxy = read("src/proxy.ts");

    expect(proxy).toMatch(/export async function proxy\(/);
    expect(proxy).toContain("createServerClient");
    expect(proxy).toContain("auth.getUser()");
    // The refreshed cookies must ride whatever response the routing logic returns,
    // otherwise the rotated refresh token is dropped and the session logs out.
    expect(proxy).toContain("response.cookies.set(name, value");
    // Next 16 renamed the convention; leaving middleware.ts behind restores the
    // deprecation warning and splits the pipeline across two entry points.
    expect(existsSync(resolve(process.cwd(), "src/middleware.ts"))).toBe(false);
  });

  it("proxy hands the refreshed session to the render for the same request", () => {
    const proxy = read("src/proxy.ts");

    // Response-only cookies leave the render reading the pre-refresh session, so the
    // request itself has to carry them too.
    expect(proxy).toContain("request.cookies.set(");
    // The response/redirect/rewrite path must keep attaching them either way.
    expect(proxy).toContain("response.cookies.set(name, value");
  });

  it("has a single proxy entry point, with no stale disabled twin", () => {
    // The stub's header invites renaming it to proxy.ts, which would put two candidate
    // entry points on disk and break every route once Next picks the wrong one.
    expect(existsSync(resolve(process.cwd(), "src/proxy.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/proxy.disabled.ts"))).toBe(false);
  });

  it("leaves no retired updateSession helper behind", () => {
    expect(existsSync(resolve(process.cwd(), "src/lib/supabase/middleware.ts"))).toBe(false);
  });
});

describe("notification client wiring", () => {
  const notifications = () => readFileSync(resolve(process.cwd(), "src/lib/notifications/actions.ts"), "utf8");

  // Every function body, from its own `export async function` to the next one.
  function bodyOf(source: string, name: string): string {
    const start = source.indexOf(`export async function ${name}(`);
    expect(start, `${name} is missing from src/lib/notifications/actions.ts`).toBeGreaterThan(-1);
    const rest = source.slice(start + 1);
    const next = rest.indexOf("export async function ");
    return rest.slice(0, next === -1 ? undefined : next);
  }

  it.each(["getNotifications", "getUnreadNotificationCount"])(
    "%s reads through the read-only client, since layouts await it during a render",
    (name) => {
      const body = bodyOf(notifications(), name);

      expect(body).toContain("await createServerSupabase()");
      expect(body).not.toContain("createServerSupabaseClient");
      expect(body).not.toContain("createAdminClient");
    },
  );

  it.each(["markNotificationRead", "markAllNotificationsRead"])(
    "%s keeps the read-write client, since it runs as a Server Action",
    (name) => {
      expect(bodyOf(notifications(), name)).toContain("await createServerSupabaseClient()");
    },
  );

  it("checkAndNotifyDueInstallments keeps the admin client for its cross-role writes", () => {
    expect(bodyOf(notifications(), "checkAndNotifyDueInstallments")).toContain("createAdminClient()");
  });
});
