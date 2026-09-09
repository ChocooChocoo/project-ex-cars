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

test.describe("Supplier Portal Option A — Fully Hidden", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD required");

  test("supplier pending sees No supplier record checklist on /supplier/overview", async ({ page }) => {
    await signInAs(page, "supplier_pending@gce.local");
    await page.goto("/supplier/overview");
    await expect(page.getByText(/No supplier record — invite pending/i)).toBeVisible();
  });

  test("supplier approved sees profile + verification + Messages badge", async ({ page }) => {
    await signInAs(page, "supplier@gce.local");
    await page.goto("/supplier/overview");
    await expect(page.getByRole("heading", { name: "My Supplier Profile" })).toBeVisible();
    await expect(page.getByText(/primary IDs verified/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Messages" })).toBeVisible();
  });

  test("supplier direct /customer/* redirects to /supplier/overview (defense-depth)", async ({ page }) => {
    await signInAs(page, "supplier@gce.local");
    await page.goto("/customer/showroom");
    await expect(page).toHaveURL(/\/supplier\/overview/);
    await page.goto("/customer/recommendations");
    await expect(page).toHaveURL(/\/supplier\/overview/);
  });

  test("supplier nav shows only Supplier Portal (2 items), no Customer Portal", async ({ page }) => {
    await signInAs(page, "supplier@gce.local");
    await page.goto("/supplier/overview");
    await expect(page.getByRole("link", { name: "My Supplier Profile" })).toBeVisible();
    // Customer Portal items must NOT be visible
    await expect(page.getByRole("link", { name: "Showroom" })).toHaveCount(0);
    await expect(page.getByText("Customer Portal")).toHaveCount(0);
  });

  test("customer unaffected still sees Customer Portal", async ({ page }) => {
    await signInAs(page, "customer@gce.local");
    await page.goto("/customer/showroom");
    await expect(page.getByText("Virtual Showroom")).toBeVisible();
  });
});
