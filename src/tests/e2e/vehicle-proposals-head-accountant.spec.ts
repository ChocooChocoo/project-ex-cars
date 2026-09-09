import { expect, test } from "@playwright/test";

const seedPassword = process.env.SEED_USER_PASSWORD;

function requirePassword(): string {
  if (!seedPassword) throw new Error("SEED_USER_PASSWORD required");
  return seedPassword;
}

async function signInAs(page: import("@playwright/test").Page, email: string) {
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(requirePassword());
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 15000 }).catch(() => undefined);
}

test.describe("Head Accountant price proposals read-only", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD required");

  test("head_accountant sees pending proposals but no Approve button", async ({ page }) => {
    await signInAs(page, "head_accountant@gce.local");
    await page.goto("/dashboard/vehicles");
    await expect(page.getByRole("heading", { name: "Vehicle Inventory" })).toBeVisible();
    // Pending tab should be visible and show proposals if any
    await expect(
      page.getByRole("tab", { name: "Pending" }).or(page.getByText("Pending Price Approvals")),
    ).toBeVisible();
    // Open first proposal actions if exists
    const actionButton = page.getByRole("button", { name: /Open actions for/ }).first();
    if (await actionButton.isVisible()) {
      await actionButton.click();
      await expect(page.getByRole("menuitem", { name: "View Details" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Approve" })).toHaveCount(0);
      await expect(page.getByRole("menuitem", { name: "Reject" })).toHaveCount(0);
    } else {
      // No proposals is acceptable — verify read-only header exists
      await expect(page.getByTestId("ha-vehicle-summary")).toBeVisible();
    }
  });

  test("ceo still sees Approve when pending exists", async ({ page }) => {
    await signInAs(page, "ceo@gce.local");
    await page.goto("/dashboard/vehicles");
    await expect(page.getByRole("heading", { name: "Vehicle Inventory" })).toBeVisible();
    const actionButton = page.getByRole("button", { name: /Open actions for/ }).first();
    if (await actionButton.isVisible()) {
      await actionButton.click();
      await expect(page.getByRole("menuitem", { name: "Approve" })).toBeVisible();
    }
  });
});
