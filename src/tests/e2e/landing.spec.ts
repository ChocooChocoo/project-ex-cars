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

  test("the financing estimate adds 10% to the chosen car's price", async ({ page }) => {
    await page.goto("/");
    const car = page.getByLabel("Car");
    // The option text ends with the car's price, e.g. "2021 Suzuki Ertiga (₱905,264)".
    const label = await car.locator("option:checked").innerText();
    const price = Number(label.match(/₱([\d,]+)\)$/)?.[1].replaceAll(",", ""));
    await page.getByText("5 yrs", { exact: true }).click();
    const expected = Math.round(price * 1.1).toLocaleString("en-PH");
    await expect(page.getByTestId("financed-total")).toHaveText(`₱${expected}`);
  });

  test("a signed-in customer is sent from / to the showroom", async ({ page }) => {
    test.skip(!seedPassword, "SEED_USER_PASSWORD is required");
    await signInAs(page, "customer@gce.local");
    await page.goto("/");
    await expect(page).toHaveURL(/\/customer\/showroom$/);
  });
});
