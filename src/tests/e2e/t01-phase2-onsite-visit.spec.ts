import { expect, type Page, test } from "@playwright/test";

// T01 Phase 2 — Buying Scenario 1, Cash Purchase: Onsite Visit (GCE Process Flows §2):
// buyer books a locked visit slot → a second request cannot take it → Sales Manager verifies and
// approves → payment recorded → Mark Sold to This Buyer (the other request closes) → Head Accountant
// sees the sale. Needs migration 00050 applied and at least one available car in the showroom.

const seedPassword = process.env.SEED_USER_PASSWORD;

const png = (name: string) => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  ),
});

// A whole-hour slot far enough ahead that reruns rarely collide.
const day = 1 + Math.floor(Math.random() * 27);
const hour = 9 + Math.floor(Math.random() * 8);
const slot = `2031-03-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`;

async function signInAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(seedPassword ?? "");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page
    .waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 15_000 })
    .catch(() => undefined);
}

async function pick(page: Page, combobox: string, option: string) {
  await page.locator(`#${combobox}`).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function startPurchase(page: Page, vehiclePath: string): Promise<string> {
  await page.goto(vehiclePath);
  await page.getByRole("button", { name: "Buy Now" }).click();
  await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
  return page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";
}

async function bookCashVisit(page: Page) {
  await pick(page, "payment_method", "Cash");
  await pick(page, "arrangement_kind", "GCE Visit");
  await page.locator("#schedule").fill(slot);
  await page.getByRole("button", { name: "Save Details" }).click();
}

async function upload(page: Page, kind: "Valid ID" | "Proof of Billing", idType?: string) {
  await pick(page, "cust-doc-kind", kind);
  if (idType) await pick(page, "cust-doc-id-type", idType);
  await page
    .locator('input[type="file"]')
    .last()
    .setInputFiles(png(`${kind}.png`));
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByText(/uploaded/).first()).toBeVisible();
}

test.describe
  .serial("T01 Phase 2 cash onsite visit", () => {
    test.skip(!seedPassword, "SEED_USER_PASSWORD required");

    let vehiclePath = "";
    let buyId = "";
    let rivalId = "";

    test("buyer books a locked slot and submits the request", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      await page.goto("/customer/showroom");
      const car = page.locator('a[href*="/showroom/"]').first();
      vehiclePath = new URL((await car.getAttribute("href")) ?? "", page.url()).pathname;
      buyId = await startPurchase(page, vehiclePath);

      await upload(page, "Valid ID", "Passport");
      await upload(page, "Valid ID", "Driver's License");
      await upload(page, "Proof of Billing");
      await bookCashVisit(page);
      await expect(page.getByText(/Visit slot locked for/)).toBeVisible();

      await page.getByRole("button", { name: "Submit Request" }).click();
      await expect(page.getByText("Pending Sales Manager Approval").first()).toBeVisible();
    });

    test("a second request cannot take the locked slot", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      rivalId = await startPurchase(page, vehiclePath);
      await bookCashVisit(page);
      await expect(page.getByText("That visit slot is already taken. Choose another time.")).toBeVisible();
    });

    test("Sales Manager verifies, approves and marks the car sold to this buyer", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${buyId}`);

      for (let left = 3; left > 0; left--) {
        await page.getByRole("button", { name: "Verify", exact: true }).first().click();
        await expect(page.getByRole("button", { name: "Verify", exact: true })).toHaveCount(left - 1);
      }
      await page.getByRole("button", { name: /Approve/ }).click();
      await expect(page.getByText("Approved").first()).toBeVisible();

      await page.locator("#pay_amount").fill("500000");
      await page.getByRole("button", { name: "Record Payment" }).click();
      await page.getByRole("button", { name: /Mark Sold to This Buyer/ }).click();
      await expect(page.getByText("Sold").first()).toBeVisible();

      await page.goto(`/sales_manager/transactions/${rivalId}`);
      await expect(page.getByText("Cancelled").first()).toBeVisible();
    });

    test("Head Accountant sees the sale in the records", async ({ page }) => {
      await signInAs(page, "head_accountant@gce.local");
      await page.goto("/head_accountant/finance");
      await expect(page.getByText("Sale records")).toBeVisible();
      await expect(page.locator(`a[href$="/transactions/${buyId}"]`)).toBeVisible();
    });
  });
