import { expect, type Page, test } from "@playwright/test";

const seedPassword = process.env.SEED_USER_PASSWORD;

function getSeedPassword() {
  if (!seedPassword) {
    throw new Error("SEED_USER_PASSWORD is required for the employee requests table browser regression.");
  }
  return seedPassword;
}

async function signInAsCeo(page: Page) {
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill("ceo@gce.local");
  await page.getByLabel("Password", { exact: true }).fill(getSeedPassword());
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 15000 });
  await page.goto("/ceo/employee-requests");
  await expect(page).toHaveURL(/\/ceo\/employee-requests$/);
}

test.describe("CEO employee requests table", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD is required for the employee requests table browser regression.");

  test("uses the canonical route with shared pagination and responsive table behavior", async ({ page }) => {
    await signInAsCeo(page);

    await expect(page.getByRole("heading", { name: "Employee Requests", exact: true })).toBeVisible();
    await expect(page.locator("#employee-requests-rows-per-page")).toBeVisible();
    await expect(page.getByText(/^Page 1 of [2-9]\d*$/, { exact: true })).toBeVisible();
    const firstPageRows = await page.locator("tbody tr").count();
    expect(firstPageRows).toBeGreaterThan(0);
    expect(firstPageRows).toBeLessThanOrEqual(10);

    await page.getByRole("navigation", { name: "pagination" }).getByRole("button", { name: "2", exact: true }).click();
    await expect(page.getByText(/^Page 2 of \d+$/, { exact: true })).toBeVisible();
    const secondPageRows = await page.locator("tbody tr").count();
    expect(secondPageRows).toBeGreaterThan(0);
    expect(secondPageRows).toBeLessThanOrEqual(10);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.locator("table")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
