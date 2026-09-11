import { expect, type Page, test } from "@playwright/test";

const seedPassword = process.env.SEED_USER_PASSWORD;

async function signIn(page: Page, email: string) {
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(seedPassword ?? "");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page
    .waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 15_000 })
    .catch(() => undefined);
}

// Rewrites the stored Supabase session so the access token reads as expired while the
// refresh token stays valid. This is the "returning user after >1h" state that used to
// produce HTTP 500 from src/lib/supabase/server.ts:48.
async function expireAccessToken(page: Page) {
  const rewritten = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    if (!key) return null;
    const session = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!session) return null;
    session.expires_at = Math.floor(Date.now() / 1000) - 600;
    localStorage.setItem(key, JSON.stringify(session));
    return { key, hasRefreshToken: typeof session.refresh_token === "string" };
  });

  // Cookie-based sessions are what the server reads; clear those so the next request
  // presents an expired session rather than the still-fresh one the browser wrote.
  const cookies = await page.context().cookies();
  const authCookies = cookies.filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  for (const cookie of authCookies) {
    const decoded = Buffer.from(cookie.value.replace(/^base64-/, ""), "base64url").toString("utf8");
    let session: Record<string, unknown>;
    try {
      session = JSON.parse(decoded);
    } catch {
      continue;
    }
    session.expires_at = Math.floor(Date.now() / 1000) - 600;
    await page.context().addCookies([
      {
        ...cookie,
        value: `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`,
      },
    ]);
  }

  return { rewritten, authCookieCount: authCookies.length };
}

test.describe("expired session handling", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD required");

  test("an expired access token renders the page instead of a 500", async ({ page }) => {
    await signIn(page, "confidential_informant@gce.local");
    await expect(page).not.toHaveURL(/\/auth\/v1\/login/);

    const state = await expireAccessToken(page);
    expect(state.authCookieCount).toBeGreaterThan(0);

    const response = await page.goto("/confidential_informant/field-cases");

    // The regression produced 500 here.
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: "Field Cases", exact: true })).toBeVisible();
    await expect(page.getByText(/A server error occurred/i)).toHaveCount(0);
  });

  test("the proxy refreshes the expired session and keeps the user signed in", async ({ page }) => {
    await signIn(page, "confidential_informant@gce.local");
    await expect(page).not.toHaveURL(/\/auth\/v1\/login/);

    await expireAccessToken(page);
    await page.goto("/confidential_informant/field-cases");

    // Refreshed by the proxy, so no bounce to login.
    await expect(page).not.toHaveURL(/\/auth\/v1\/login/);

    // Reload again: a rotated refresh token must have been persisted, otherwise the
    // second request would present a spent token and log the user out.
    await page.reload();
    await expect(page).not.toHaveURL(/\/auth\/v1\/login/);
    await expect(page.getByRole("heading", { name: "Field Cases", exact: true })).toBeVisible();
  });
});
