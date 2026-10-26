import { test } from "@playwright/test";

import { expect, open, signInAs } from "./support/t01";

// Client change requests, Phase 1 (docs/implementation-plan/client-change-requests/phase-1.md): sidebar
// "Dashboard" label (G2), brand label and link (G4), no non-PHP currency (G5, AM2), no notification list on the
// dashboard (SM3, AM1), no empty Actions column for the Sales Manager (SM4), no customers in Staff Records (AM3).

const shot = (name: string) => `test-results/client-phase1-${name}.png`;

test("Sales Manager: Dashboard label, GCE Admin brand, no bottom notifications, no Actions column", async ({
  page,
}) => {
  await signInAs(page, "sales_manager@gce.local");
  await open(page, "/sales_manager/vehicles");

  const sidebar = page.locator("[data-sidebar='sidebar']").first();
  await expect(sidebar.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(sidebar.getByText("Default", { exact: true })).toHaveCount(0);

  await expect(page.getByRole("columnheader", { name: "Mileage" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
  await page.screenshot({ path: shot("sm-vehicles"), fullPage: true });

  await sidebar.getByRole("link", { name: "GCE Admin" }).click();
  await page.waitForURL("**/sales_manager/dashboard");
  await expect(page.getByText("Notifications", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: shot("sm-dashboard"), fullPage: true });
});

test("Marketing Specialist keeps the Actions column", async ({ page }) => {
  await signInAs(page, "marketing_specialist@gce.local");
  await open(page, "/marketing_specialist/vehicles");
  await expect(page.getByRole("columnheader", { name: "Actions" })).toBeVisible();
});

test("Account Manager: Staff Records lists no customers, Inventory Allocation has no currency choice", async ({
  page,
}) => {
  await signInAs(page, "account_manager@gce.local");
  await open(page, "/account_manager/staff-records");
  await expect(page.getByText("Staff accounts with role, schedule, and status.")).toBeVisible();
  await expect(page.getByRole("cell", { name: /^customer$/i })).toHaveCount(0);
  await page.screenshot({ path: shot("am-staff-records"), fullPage: true });

  await open(page, "/account_manager/recommendations");
  await expect(page.getByText("Inventory Allocation")).toBeVisible();
  await expect(page.getByText(/Euro Balance|USD Balance|GBP Balance|PHP Balance/)).toHaveCount(0);
  await page.screenshot({ path: shot("am-inventory-allocation"), fullPage: true });
});

test("Customer: Global Car Exchange brand opens the Showroom", async ({ page }) => {
  await signInAs(page, "customer@gce.local");
  await open(page, "/customer/my-transactions");
  const brand = page.locator("[data-sidebar='sidebar']").first().getByRole("link", { name: "Global Car Exchange" });
  await expect(brand).toBeVisible();
  await brand.click();
  await page.waitForURL("**/customer/showroom");
  await page.screenshot({ path: shot("customer-showroom") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: shot("customer-390") });
});
