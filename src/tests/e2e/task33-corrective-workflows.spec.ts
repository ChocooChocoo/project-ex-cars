import { expect, type Page, test } from "@playwright/test";

const seedPassword = process.env.SEED_USER_PASSWORD;

async function signInAs(page: Page, email: string) {
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(seedPassword ?? "");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page
    .waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 15_000 })
    .catch(() => undefined);
}

test.describe("Task 33 corrective workflows", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD required");

  test("field case selections keep the create dialog open", async ({ page }) => {
    await signInAs(page, "ceo@gce.local");
    await page.goto("/ceo/field-cases");
    await page.getByRole("button", { name: "Create Field Case", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const transaction = dialog.getByRole("combobox", { name: "Select transaction" });
    await transaction.click();
    const transactionOption = page
      .getByRole("option")
      .filter({ hasText: /Buy|Sell|Request a Car/ })
      .first();
    await expect(transactionOption).toBeVisible();
    await transactionOption.click();
    await expect(dialog).toBeVisible();

    const vehicle = dialog.getByRole("combobox", { name: "Select vehicle" });
    await vehicle.click();
    const vehicleOption = page.getByRole("option").filter({ hasNotText: "No vehicle" }).first();
    await expect(vehicleOption).toBeVisible();
    await vehicleOption.click();
    await expect(dialog).toBeVisible();
  });

  test("Account Manager reaches create walk-in from the navigation", async ({ page }) => {
    await signInAs(page, "account_manager@gce.local");

    const walkInLink = page.getByRole("link", { name: "Create Walk-In", exact: true });
    await expect(walkInLink).toBeVisible();
    await walkInLink.click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create Walk-in Account" })).toBeVisible();
  });

  test("CEO does not receive the Account Manager walk-in shortcut", async ({ page }) => {
    await signInAs(page, "ceo@gce.local");

    await expect(page.getByRole("link", { name: "Create Walk-In", exact: true })).toHaveCount(0);
  });
});
