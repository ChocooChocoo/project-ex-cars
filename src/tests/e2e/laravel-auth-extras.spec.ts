import { type Browser, expect, type Page, test } from "@playwright/test";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Phase 3 done-when checks beyond plain sign-in. Same setup as laravel-auth.spec.ts.
const seedPassword = process.env.SEED_USER_PASSWORD ?? "";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
// Local Laravel writes mail to its log (MAIL_MAILER=log); the reset test reads the emailed link there.
const mailLog = resolve(process.cwd(), "backend/storage/logs/laravel.log");

async function signIn(page: Page, email: string, password = seedPassword) {
  await page.goto("/auth/v1/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/"), { timeout: 60_000 });
}

function laravelMe(page: Page) {
  return page.evaluate(async (url) => {
    const res = await fetch(`${url}/api/v1/me`, { credentials: "include", headers: { Accept: "application/json" } });
    return res.ok ? ((await res.json()) as { role: string; email: string }) : res.status;
  }, apiUrl);
}

/** Request a reset link through the UI and return the link Laravel "emailed" (from the mail log). */
async function requestResetLink(page: Page, email: string): Promise<string> {
  const before = existsSync(mailLog) ? readFileSync(mailLog, "utf8").length : 0;
  await page.goto("/auth/v1/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page.waitForURL(/\/auth\/v1\/forgot-password/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account uses that email, we sent a reset link.")).toBeVisible();

  let link: string | undefined;
  await expect
    .poll(() => {
      const fresh = readFileSync(mailLog, "utf8").slice(before).replaceAll("&amp;", "&");
      link = fresh.match(/https?:\/\/[^\s"<>)\]]+\/auth\/v1\/reset-password\?token=[^\s"<>)\]]+/)?.[0];
      return link;
    })
    .toBeTruthy();
  return new URL(link as string).pathname + new URL(link as string).search;
}

async function setNewPassword(page: Page, path: string, password: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Set new password" }).click();
  await page.waitForURL(/\/auth\/v1\/login\/?\?notice=password_reset/);
  await expect(page.getByText("Your password was changed. Log in with the new one.")).toBeVisible();
}

test.describe("password reset through the app's screens", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD required");
  test.skip(!existsSync(mailLog), "needs a local Laravel writing mail to backend/storage/logs/laravel.log");

  test("forgot password → emailed link → new password → log in with it", async ({ page }) => {
    const email = "head_security@gce.local";
    const temporary = "Temp#Reset9";

    await setNewPassword(page, await requestResetLink(page, email), temporary);
    await signIn(page, email, temporary);
    expect(await laravelMe(page)).toMatchObject({ role: "head_security" });

    // Put the seeded password back so the other specs keep working.
    await page.context().clearCookies();
    await setNewPassword(page, await requestResetLink(page, email), seedPassword);
    await signIn(page, email);
    expect(await laravelMe(page)).toMatchObject({ role: "head_security" });
  });

  test("an incomplete link explains itself instead of showing the form", async ({ page }) => {
    await page.goto("/auth/v1/reset-password");
    await expect(page.getByText("This reset link is incomplete.")).toBeVisible();
    await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  });
});

test.describe("two users at the same time", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD required");

  async function newUser(browser: Browser, role: string) {
    const context = await browser.newContext();
    const page = await context.newPage();
    return { role, context, page };
  }

  test("parallel sessions never see each other's identity, cookies or server-rendered data", async ({ browser }) => {
    const users = await Promise.all([newUser(browser, "customer"), newUser(browser, "ceo")]);
    await Promise.all(users.map((u) => signIn(u.page, `${u.role}@gce.local`)));

    const sessions = await Promise.all(
      users.map(async (u) => (await u.context.cookies()).find((c) => c.name === "gce_session")?.value),
    );
    expect(sessions[0]).toBeTruthy();
    expect(sessions[0]).not.toBe(sessions[1]);

    // Interleave server renders and API calls; each must stay its own user throughout.
    for (let round = 0; round < 3; round++) {
      await Promise.all(users.map((u) => u.page.reload()));
      const results = await Promise.all(
        users.map(async (u) => ({ me: await laravelMe(u.page), path: new URL(u.page.url()).pathname })),
      );
      for (const [i, u] of users.entries()) {
        expect(results[i].me).toMatchObject({ role: u.role, email: `${u.role}@gce.local` });
        expect(results[i].path.startsWith(`/${u.role}/`)).toBe(true);
      }
    }

    // The customer cannot open the CEO's pages; the server bounces it (Laravel role, not the URL, decides).
    await users[0].page.goto("/ceo/dashboard");
    await expect(users[0].page).not.toHaveURL(/\/ceo\//);

    await Promise.all(users.map((u) => u.context.close()));
  });
});

test.describe("preferences still work with Laravel sessions", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD required");

  test("theme (client storage) and sidebar variant (server-read cookie) survive a reload", async ({ page }) => {
    await signIn(page, "ceo@gce.local");
    await page.waitForLoadState("networkidle");
    // Seeded accounts first see the onboarding tour, a modal that hides the header controls.
    const skip = page.getByRole("button", { name: /^skip/i });
    await skip
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => undefined);
    if (await skip.count()) await skip.first().click();
    const html = page.locator("html");

    const before = await html.getAttribute("data-theme-mode");
    await page.getByRole("button", { name: /Current theme:/ }).click();
    await expect(html).not.toHaveAttribute("data-theme-mode", before ?? "");
    const chosen = await html.getAttribute("data-theme-mode");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme-mode", chosen ?? "");

    // sidebar_variant is layout-critical: the staff layout reads it from the cookie during SSR.
    const url = new URL(page.url());
    await page.context().addCookies([{ name: "sidebar_variant", value: "floating", domain: url.hostname, path: "/" }]);
    await page.reload();
    await expect(page.locator("[data-variant='floating']").first()).toBeAttached();
  });
});
