import { expect, type Page, test } from "@playwright/test";

// Phase 3 done-when: each of the ten seeded demo accounts signs in through the existing login screen
// and lands on its role's page; SSR reload, the browser's own Laravel call and sign-out all work.
// Needs: backend seeded (`php artisan migrate:fresh --seed --database=mysql_migrations`) and served on
// NEXT_PUBLIC_API_URL, SEED_USER_PASSWORD set, and the Next.js origin listed in backend SANCTUM_STATEFUL_DOMAINS.
const seedPassword = process.env.SEED_USER_PASSWORD;
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ROLES: [role: string, landingPrefix: string][] = [
  ["customer", "/customer/showroom"],
  ["ceo", "/ceo/"],
  ["super_admin", "/super_admin/"],
  ["account_manager", "/account_manager/"],
  ["head_accountant", "/head_accountant/"],
  ["confidential_informant", "/confidential_informant/"],
  ["marketing_specialist", "/marketing_specialist/"],
  ["mechanic", "/mechanic/"],
  ["sales_manager", "/sales_manager/"],
  ["head_security", "/head_security/"],
];

async function laravelMe(page: Page) {
  return page.evaluate(async (url) => {
    const res = await fetch(`${url}/api/v1/me`, { credentials: "include", headers: { Accept: "application/json" } });
    return res.ok ? ((await res.json()) as { role: string }).role : res.status;
  }, apiUrl);
}

test.describe("Laravel sign-in for every seeded role", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD required");

  for (const [role, landing] of ROLES) {
    test(`${role} signs in, reloads, sees itself in Laravel and signs out`, async ({ page }) => {
      await page.goto("/auth/v1/login");
      await page.getByLabel("Email Address", { exact: true }).fill(`${role}@gce.local`);
      await page.getByLabel("Password", { exact: true }).fill(seedPassword ?? "");
      await page.getByRole("button", { name: "Login", exact: true }).click();
      await page.waitForURL((url) => url.pathname.startsWith(landing), { timeout: 60_000 });

      const cookies = await page.context().cookies();
      expect(cookies.find((c) => c.name === "gce_session")?.httpOnly).toBe(true);
      expect(cookies.find((c) => c.name === "gce-role")?.value).toBe(role);

      // Deep-link SSR reload keeps the session (the layout re-checks /api/v1/me server-side).
      expect((await page.reload())?.status()).toBeLessThan(500);
      await expect(page).not.toHaveURL(/\/auth\/v1\/login/);

      // The browser's credentialed call to Laravel identifies the same account.
      expect(await laravelMe(page)).toBe(role);

      // Seeded accounts have not finished onboarding; the tour overlay would block the menu.
      const skip = page.getByRole("button", { name: /^skip/i });
      await skip
        .first()
        .waitFor({ timeout: 10_000 })
        .catch(() => undefined);
      if (await skip.count()) await skip.first().click();

      await page.evaluate(() => document.querySelector("nextjs-portal")?.remove()); // dev-only indicator
      await page.locator("[data-slot='avatar']:visible").last().click();
      await page.getByRole("menuitem", { name: /sign out/i }).click();
      await page.waitForURL(/\/auth\/v1\/login/);
      expect(await laravelMe(page)).toBe(401);
    });
  }
});
