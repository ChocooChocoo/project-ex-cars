import { afterEach, describe, expect, it, vi } from "vitest";

import { browserApi } from "./client";

function setCookie(value: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: the client reads document.cookie, so the test sets it directly.
  document.cookie = value;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setCookie("XSRF-TOKEN=; max-age=0; path=/");
});

describe("browserApi", () => {
  it("refreshes a stale CSRF token once and retries the write", async () => {
    setCookie("XSRF-TOKEN=stale; path=/");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "csrf_mismatch" }), { status: 419 }))
      .mockImplementationOnce(async () => {
        setCookie("XSRF-TOKEN=fresh; path=/");
        return new Response(null, { status: 204 });
      })
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(browserApi("POST", "/api/v1/auth/login", { email: "a@b.co" })).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/sanctum/csrf-cookie");
    expect(fetchMock.mock.calls[2][1].headers["X-XSRF-TOKEN"]).toBe("fresh");
  });

  it("does not loop when the retry also fails", async () => {
    setCookie("XSRF-TOKEN=stale; path=/");
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("csrf-cookie")
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ code: "csrf_mismatch", message: "CSRF token mismatch." }), { status: 419 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(browserApi("POST", "/api/v1/auth/login", {})).rejects.toMatchObject({ status: 419 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
