import { expect, type Page, test } from "@playwright/test";

const seedPassword = process.env.SEED_USER_PASSWORD;
const SECURITY_DUTY_PATH = "/ceo/security-duty-checks";

function getSeedPassword() {
  if (!seedPassword) {
    throw new Error("SEED_USER_PASSWORD is required for the security duty checks browser regression.");
  }
  return seedPassword;
}

async function signIn(page: Page, email: string) {
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(getSeedPassword());
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 15000 }).catch(() => undefined);
  await page.goto(SECURITY_DUTY_PATH);
  const rolePath = email === "head_security@gce.local" ? "/head_security/security-duty-checks" : SECURITY_DUTY_PATH;
  await expect(page).toHaveURL(new RegExp(`${rolePath.replaceAll("/", "\\/")}$`));
  await expect(page.getByRole("heading", { name: "Security Duty Checks", exact: true })).toBeVisible();
}

async function assertNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe("security duty checks views", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD is required for the security duty checks browser regression.");

  test("CEO can switch views without changing the route", async ({ page }) => {
    await signIn(page, "ceo@gce.local");
    const viewGroup = page.getByRole("radiogroup", { name: "Duty check view", exact: true });
    const table = viewGroup.getByRole("radio", { name: "Table", exact: true });
    const list = viewGroup.getByRole("radio", { name: "List", exact: true });
    const grid = viewGroup.getByRole("radio", { name: "Grid", exact: true });

    await expect(table).toHaveAttribute("aria-checked", "true");
    const route = page.url();

    const hasChecks =
      (await page.getByTestId("duty-check-grid").count()) > 0 || (await page.locator("table").count()) > 0;
    if (!hasChecks) {
      await expect(page.getByText("No duty checks recorded.", { exact: true })).toBeVisible();
    } else {
      await expect(page.locator("table")).toBeVisible();
      await expect(page.locator("#security-duty-checks-rows-per-page")).toBeVisible();
    }

    await list.click();
    await expect(list).toHaveAttribute("aria-checked", "true");
    if (hasChecks) await expect(page.getByTestId("duty-check-item").first()).toBeVisible();
    expect(page.url()).toBe(route);

    await grid.click();
    await expect(grid).toHaveAttribute("aria-checked", "true");
    if (hasChecks) await expect(page.getByTestId("duty-check-grid")).toBeVisible();
    expect(page.url()).toBe(route);
  });

  test("all views stay within narrow and wide responsive layouts", async ({ page }) => {
    await signIn(page, "ceo@gce.local");

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.reload();
      await assertNoPageOverflow(page);

      await page.getByRole("radio", { name: "List", exact: true }).click();
      await assertNoPageOverflow(page);
      await page.getByRole("radio", { name: "Grid", exact: true }).click();
      await assertNoPageOverflow(page);
      await page.getByRole("radio", { name: "Table", exact: true }).click();
      await assertNoPageOverflow(page);
    }
  });

  test("CEO is read-only while Head Security receives duty actions", async ({ page }) => {
    await signIn(page, "ceo@gce.local");
    await expect(page.getByRole("button", { name: "Start Check", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Choose .* evidence/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Complete Check", exact: true })).toHaveCount(0);

    await signIn(page, "head_security@gce.local");
    await expect(page.getByRole("button", { name: "Start Check", exact: true })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Duty check view", exact: true })).toBeVisible();
  });
});
