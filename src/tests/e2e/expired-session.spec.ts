import { expect, type Page, test } from "@playwright/test";

// Phase 3: sessions are Laravel's (gce_session cookie). Needs the Laravel API running and seeded:
// `php artisan migrate:fresh --seed --database=mysql_migrations` in backend/, then `php artisan serve`.
const seedPassword = process.env.SEED_USER_PASSWORD;
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function signIn(page: Page, email: string) {
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(seedPassword ?? "");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 30_000 });
}

async function sessionCookie(page: Page) {
  const cookie = (await page.context().cookies()).find((c) => c.name === "gce_session");
  expect(cookie?.httpOnly).toBe(true);
  return cookie as NonNullable<typeof cookie>;
}

function meStatus(page: Page) {
  return page.evaluate(
    async (url) =>
      (await fetch(`${url}/api/v1/me`, { credentials: "include", headers: { Accept: "application/json" } })).status,
    apiUrl,
  );
}

test.describe("expired session handling", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD required");

  test("an expired or tampered session sends the user to login instead of a 500", async ({ page }) => {
    await signIn(page, "confidential_informant@gce.local");
    // Leave the app first: a polling response still in flight would set a fresh session cookie after the tamper.
    await page.goto("about:blank");
    const cookie = await sessionCookie(page);

    // Laravel cannot decrypt this value, exactly as with an idle-expired session.
    await page.context().addCookies([{ ...cookie, value: "expired" }]);
    const response = await page.goto("/confidential_informant/field-cases");

    expect(response?.status()).toBeLessThan(500);
    // The static page loads, /api/v1/me answers 401, then the client redirects: over the staging CDN that can take
    // longer than the default 5 s.
    await expect(page).toHaveURL(/\/auth\/v1\/login/, { timeout: 20_000 });
  });

  test("signing out invalidates the session on the server, so a copied cookie stops working", async ({ page }) => {
    await signIn(page, "confidential_informant@gce.local");
    const copied = await sessionCookie(page);
    expect(await meStatus(page)).toBe(200);

    // Sign out through the existing account menu. Seeded accounts first see the onboarding tour, and the
    // dev-mode indicator can cover the sidebar avatar.
    const skip = page.getByRole("button", { name: /^skip/i });
    await skip
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => undefined);
    if (await skip.count()) await skip.first().click();
    await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
    // The account menu avatar, not the avatars in a page's table (e.g. Users).
    await page.locator("[data-slot='avatar']:visible:not(table [data-slot='avatar'])").last().click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/auth\/v1\/login/);

    await page.context().addCookies([copied]);
    expect(await meStatus(page)).toBe(401);
    await page.goto("/confidential_informant/dashboard");
    await expect(page).toHaveURL(/\/auth\/v1\/login/);
  });
});
