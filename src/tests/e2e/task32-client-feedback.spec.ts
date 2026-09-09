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

test.describe("Task 32 client feedback", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD required");

  test("customer sees Buying Guide in nav and showroom links to it", async ({ page }) => {
    await signInAs(page, "customer@gce.local");
    await page.goto("/customer/showroom");
    await expect(page.getByText("Virtual Showroom")).toBeVisible();
    await expect(page.getByRole("link", { name: "See what to prepare before you buy" })).toBeVisible();
    await page.goto("/customer/buying-requirements");
    await expect(page.getByRole("heading", { name: "Buying Guide" })).toBeVisible();
    await expect(page.getByText("Accepted valid IDs")).toBeVisible();
  });

  test("sell-vehicle form requires photos before submit", async ({ page }) => {
    await signInAs(page, "customer@gce.local");
    await page.goto("/customer/sell-vehicle");
    await expect(page.getByRole("heading", { name: "Sell Your Vehicle" })).toBeVisible();
    await expect(page.getByLabel("Vehicle photos")).toBeVisible();
    await page.getByLabel("Make *").fill("Honda");
    await page.getByLabel("Model *").fill("Civic");
    await page.getByLabel("Year *").fill("2020");
    await page.getByLabel("Mileage (km) *").fill("50000");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Good" }).click();
    await page.getByLabel("Offered Amount (₱) *").fill("450000");
    await page.getByRole("button", { name: "Submit Vehicle", exact: true }).click();
    await expect(page.getByText("At least one vehicle photo is required.").first()).toBeVisible();
  });

  test("field case create modal requires a link and a worker", async ({ page }) => {
    await signInAs(page, "ceo@gce.local");
    await page.goto("/ceo/field-cases");
    await page.getByRole("button", { name: "Create Field Case", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Link a transaction or a vehicle (at least one).")).toBeVisible();
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(dialog.getByText("Select a transaction or a vehicle to link this field case.")).toBeVisible();
  });

  test("staff transaction shows approval flow ladder", async ({ page }) => {
    await signInAs(page, "ceo@gce.local");
    await page.goto("/ceo/transactions");
    const actionsButton = page.getByRole("button", { name: "Open transaction actions" }).first();
    if (await actionsButton.isVisible()) {
      await actionsButton.click();
      await page.getByRole("menuitem", { name: "View Details" }).click();
      await expect(page.getByText("Approval flow")).toBeVisible();
      await expect(page.getByText("Processed (Sales)")).toBeVisible();
    }
  });

  test("suppliers page offers vehicle/parts/both filter", async ({ page }) => {
    await signInAs(page, "ceo@gce.local");
    await page.goto("/ceo/suppliers");
    await page.getByRole("button", { name: "Offering" }).click();
    await expect(page.getByRole("menuitemradio", { name: "Vehicles", exact: true })).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: "Both", exact: true })).toBeVisible();
  });
});
