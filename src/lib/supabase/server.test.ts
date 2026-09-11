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
});
