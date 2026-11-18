// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Me } from "./types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const jar = vi.hoisted(() => ({
  cookies: [] as { name: string; value: string }[],
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => jar.cookies, set: jar.set, delete: jar.delete })),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { apiGet, apiWrite, relaySetCookies } = await import("./server");

function reply(status: number, body: unknown, setCookies: string[] = []) {
  const headers = new Headers();
  for (const c of setCookies) headers.append("set-cookie", c);
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

const sentHeaders = (call = 0) => fetchMock.mock.calls[call][1].headers as Record<string, string>;

beforeEach(() => {
  fetchMock.mockReset();
  jar.set.mockReset();
  jar.delete.mockReset();
  // cookies().getAll() returns decoded values.
  jar.cookies = [
    { name: "gce_session", value: "sess" },
    { name: "XSRF-TOKEN", value: "tok=" },
    { name: "remember_web_abc", value: "rem" },
    { name: "gce-role", value: "ceo" },
    { name: "theme_mode", value: "dark" },
    { name: "sb-old-auth-token", value: "x" },
  ];
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
  process.env.APP_ORIGIN = "http://app.test";
});

describe("server adapter", () => {
  it("forwards only Laravel's cookies, with the trusted origin, to the fixed API origin", async () => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    await apiGet("/api/v1/me");

    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/v1/me");
    const headers = sentHeaders();
    expect(headers.Cookie).toBe("gce_session=sess; XSRF-TOKEN=tok%3D; remember_web_abc=rem");
    expect(headers.Origin).toBe("http://app.test");
    expect(headers.Referer).toBe("http://app.test/");
    expect(headers["X-XSRF-TOKEN"]).toBeUndefined(); // reads carry no CSRF header
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
  });

  it("refuses absolute URLs so it can never be pointed at another host", async () => {
    await expect(apiGet("https://evil.example/x")).rejects.toThrow(/relative path/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the decoded XSRF token on writes", async () => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }));
    await apiWrite("PATCH", "/api/v1/me/profile", { full_name: "A" });
    expect(sentHeaders()["X-XSRF-TOKEN"]).toBe("tok=");
    expect(fetchMock.mock.calls[0][1].body).toBe('{"full_name":"A"}');
  });

  it("fetches a CSRF cookie first when the browser has none, and returns every Set-Cookie", async () => {
    jar.cookies = [];
    fetchMock
      .mockResolvedValueOnce(reply(204, null, ["XSRF-TOKEN=fresh%3D; path=/", "gce_session=pre; path=/; httponly"]))
      .mockResolvedValueOnce(reply(200, { id: "u1" }, ["gce_session=post; path=/; httponly"]));

    const result = await apiWrite("POST", "/api/v1/auth/login", { email: "a@b.co", password: "x" });

    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/sanctum/csrf-cookie");
    expect(sentHeaders(1).Cookie).toBe("XSRF-TOKEN=fresh%3D; gce_session=pre");
    expect(sentHeaders(1)["X-XSRF-TOKEN"]).toBe("fresh=");
    expect(result.setCookies).toEqual([
      "XSRF-TOKEN=fresh%3D; path=/",
      "gce_session=pre; path=/; httponly",
      "gce_session=post; path=/; httponly",
    ]);
  });

  it("keeps auth failures, validation errors and outages distinct", async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { code: "not_authenticated", message: "You must be signed in." }));
    await expect(apiGet("/api/v1/me")).rejects.toMatchObject({
      status: 401,
      code: "not_authenticated",
      isAuthFailure: true,
    });

    fetchMock.mockResolvedValueOnce(
      reply(422, { code: "validation_error", message: "Bad", fieldErrors: { email: ["Bad"] } }),
    );
    await expect(apiWrite("POST", "/api/v1/x", {})).rejects.toMatchObject({
      code: "validation_error",
      fieldErrors: { email: ["Bad"] },
    });

    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(apiGet("/api/v1/me")).rejects.toMatchObject({ status: 0, code: "api_unavailable", isOutage: true });
  });

  it("encodes base64 cookie values exactly once (a raw + would reach PHP as a space)", async () => {
    fetchMock.mockResolvedValue(reply(200, {}));
    jar.cookies = [{ name: "gce_session", value: "ab+cd/ef==" }];
    await apiGet("/api/v1/me");
    expect(sentHeaders().Cookie).toBe("gce_session=ab%2Bcd%2Fef%3D%3D");
  });

  it("each request uses its own cookies: no module-level cache leaks one user's session to another", async () => {
    fetchMock.mockImplementation(async () => reply(200, {}));
    jar.cookies = [{ name: "gce_session", value: "alice" }];
    await apiGet("/api/v1/me");
    jar.cookies = [{ name: "gce_session", value: "bob" }];
    await apiGet("/api/v1/me");
    expect(sentHeaders(0).Cookie).toBe("gce_session=alice");
    expect(sentHeaders(1).Cookie).toBe("gce_session=bob");
  });
});

describe("relaySetCookies", () => {
  it("stores the decoded value, so the browser ends up with the exact cookie Laravel issued", async () => {
    await relaySetCookies(["gce_session=ab%2Bcd%3D; path=/; httponly"]);
    expect(jar.set).toHaveBeenCalledWith("gce_session", "ab+cd=", expect.objectContaining({ httpOnly: true }));
  });

  it("copies Laravel's cookies with their attributes and ignores anything else", async () => {
    await relaySetCookies([
      "gce_session=abc; expires=Wed, 01 Jan 2099 00:00:00 GMT; Max-Age=7200; path=/; domain=.gce.test; secure; httponly; samesite=lax",
      "XSRF-TOKEN=t%3D; path=/; samesite=lax",
      "evil=1; path=/",
    ]);
    expect(jar.set).toHaveBeenCalledWith(
      "gce_session",
      "abc",
      expect.objectContaining({
        path: "/",
        domain: ".gce.test",
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7200,
      }),
    );
    expect(jar.set).toHaveBeenCalledWith("XSRF-TOKEN", "t=", expect.objectContaining({ path: "/" }));
    expect(jar.set).toHaveBeenCalledTimes(2);
  });

  it("turns Laravel's expired cookie into a delete", async () => {
    await relaySetCookies(["remember_web_x=deleted; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/"]);
    expect(jar.delete).toHaveBeenCalledWith("remember_web_x");
    expect(jar.set).not.toHaveBeenCalled();
  });
});

// Contract: the TypeScript Me type and Laravel's MeResource must expose the same keys.
// (backend SessionTest asserts the exact JSON from the PHP side.)
describe("Me contract", () => {
  it("MeResource.php and the TypeScript Me type list the same keys", () => {
    const php = readFileSync(resolve(process.cwd(), "backend/app/Http/Resources/MeResource.php"), "utf8");
    const phpKeys = [...php.matchAll(/'([a-z_]+)' =>/g)].map((m) => m[1]).sort();

    const sample: Me = {
      id: "",
      email: "",
      email_verified: true,
      role: null,
      profile: {
        full_name: null,
        phone: null,
        address: null,
        address_line: null,
        region_code: null,
        province_code: null,
        city_code: null,
        barangay_code: null,
        avatar_url: null,
        account_state: null,
        tutorial_completed_at: null,
      },
    };
    const tsKeys = [...Object.keys(sample), ...Object.keys(sample.profile)].sort();
    expect(tsKeys).toEqual(phpKeys);
  });
});
