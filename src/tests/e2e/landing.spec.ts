import { expect, test } from "@playwright/test";

import { seedPassword, signInAs } from "./support/t01";

// T04 L1/L2: signed-out visitors land on the public page at /, and its Log in and Register buttons open the
// existing auth pages. Signed-in users still go straight to their own landing path.
test.describe("landing page", () => {
  test("a signed-out visitor sees the landing page and can open Log in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const account = page.getByRole("navigation", { name: "Account" });
    await expect(account.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/auth/v1/register");
    await account.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/auth\/v1\/login$/);
  });

  test("a signed-out Android user downloads the APK without leaving the landing page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const link = page.getByRole("link", { name: "Download Mobile App" });
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);

    expect(download.suggestedFilename()).toBe("gce-app-release.apk");
    expect(await download.failure()).toBeNull();
    await expect(page).toHaveURL("/");
  });

  // T11: financing now applies each car's own markup, so the total is no longer a fixed price × 1.1, and the
  // percentage is GCE's own figure that buyers must never see.
  test("the financing estimate shows a total above the car's price, with no percentage", async ({ page }) => {
    await page.goto("/");
    const car = page.getByLabel("Car");
    // The option text ends with the car's price, e.g. "2021 Suzuki Ertiga (₱905,264)".
    const label = await car.locator("option:checked").innerText();
    const price = Number(label.match(/₱([\d,]+)\)$/)?.[1].replaceAll(",", ""));
    await page.getByText("5 yrs", { exact: true }).click();

    const total = page.getByTestId("financed-total");
    await expect(total).toHaveText(/^₱[\d,]+$/);

    const cents = Number((await total.innerText()).replace(/[₱,]/g, ""));
    expect(cents).toBeGreaterThan(price);

    // The percentage stays inside the server: the estimate prints totals only.
    await expect(total).not.toContainText("%");
    await expect(page.getByText(/financing.*\d+%/i)).toHaveCount(0);
  });

  test("a signed-in customer is sent from / to the showroom", async ({ page }) => {
    test.skip(!seedPassword, "SEED_USER_PASSWORD is required");
    await signInAs(page, "customer@gce.local");
    await page.goto("/");
    await expect(page).toHaveURL(/\/customer\/showroom$/);
  });
});
