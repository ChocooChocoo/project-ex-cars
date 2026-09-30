import { expect, type Page, test } from "@playwright/test";

// T01 Phase 4 — Cash Purchase: Delivery (GCE Process Flows §4):
// buyer asks for delivery → Sales Manager approves and sets the fee and downpayment → Head Accountant
// records and verifies both → delivery team (CI, Mechanic, Head Security) is created → the team moves
// the status to Delivered → the buyer declines for a legitimate reason, which queues a refund.
// The missed-deadline path needs a deadline in the past, so it is covered by unit tests, not here.
// Needs migration 00052 applied, an available car, and active CI, Mechanic and Head Security accounts
// (the first of each in the worker directory must be the seeded @gce.local account).

const seedPassword = process.env.SEED_USER_PASSWORD;

const png = (name: string) => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  ),
});

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

async function pickById(page: Page, id: string, option: string) {
  await page.locator(`#${id}`).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function pickByLabel(page: Page, label: string, option?: string) {
  await page.getByRole("combobox", { name: label }).click();
  await (option ? page.getByRole("option", { name: option }) : page.getByRole("option").first()).click();
}

async function upload(page: Page, kind: "Valid ID" | "Proof of Billing", idType?: string) {
  await pickById(page, "cust-doc-kind", kind);
  if (idType) await pickById(page, "cust-doc-id-type", idType);
  await page
    .locator('input[type="file"]')
    .last()
    .setInputFiles(png(`${kind}.png`));
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByText(/uploaded/).first()).toBeVisible();
}

async function recordPayment(page: Page, kind: string, amount: string) {
  await page.locator("#pay_amount").fill(amount);
  await pickById(page, "pay_method", "Bank Transfer");
  await pickById(page, "pay_kind", kind);
  await page.getByRole("button", { name: "Record Payment" }).click();
  await expect(page.getByText("Payment recorded.")).toBeVisible();
}

test.describe
  .serial("T01 Phase 4 cash delivery", () => {
    test.skip(!seedPassword, "SEED_USER_PASSWORD required");

    let txId = "";
    let fieldCasePath = "";

    test("buyer asks for delivery", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      await page.goto("/customer/showroom");
      const car = page.locator('a[href*="/showroom/"]').first();
      await page.goto(new URL((await car.getAttribute("href")) ?? "", page.url()).pathname);
      await page.getByRole("button", { name: "Buy Now" }).click();
      await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
      txId = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";

      await upload(page, "Valid ID", "Passport");
      await upload(page, "Valid ID", "Driver's License");
      await upload(page, "Proof of Billing");
      await pickById(page, "payment_method", "Cash");
      await pickById(page, "arrangement_kind", "Delivery");
      await page.locator("#schedule").fill("2031-08-20T10:00");
      await page.locator("#location").fill("123 Rizal St, Calamba, Laguna");
      await page.getByLabel(/I have reviewed this car's condition/).check();
      await page.getByRole("button", { name: "Save Details" }).click();
      await page.getByRole("button", { name: "Submit Request" }).click();
      await expect(page.getByText(/Pending Sales Manager Approval|On Hold/).first()).toBeVisible();
    });

    test("Sales Manager approves and confirms the delivery terms", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${txId}`);
      const verify = page.getByRole("button", { name: "Verify", exact: true });
      for (let left = await verify.count(); left > 0; left--) {
        await verify.first().click();
        await expect(verify).toHaveCount(left - 1);
      }
      await page.getByRole("button", { name: /^Transition Approve/ }).click();

      await pickByLabel(page, "Address serviceable", "Yes, we can deliver");
      await page.getByLabel("Delivery fee (₱)").fill("2500");
      await page.getByLabel("Downpayment (₱)").fill("50000");
      await page.getByRole("button", { name: "Confirm and notify buyer" }).click();
      await expect(page.getByText("Downpayment deadline")).toBeVisible();
    });

    test("Head Accountant records and verifies the fee and downpayment", async ({ page }) => {
      await signInAs(page, "head_accountant@gce.local");
      await page.goto(`/head_accountant/transactions/${txId}`);
      await recordPayment(page, "Delivery fee", "2500");
      await recordPayment(page, "Downpayment", "50000");
      const verify = page.getByRole("button", { name: "Verify", exact: true });
      for (let left = await verify.count(); left > 0; left--) {
        await verify.first().click();
        await expect(verify).toHaveCount(left - 1);
      }
    });

    test("Sales Manager creates the delivery team", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${txId}`);
      await pickByLabel(page, "Confidential Informant");
      await pickByLabel(page, "Mechanic");
      await pickByLabel(page, "Head Security");
      await page.getByRole("button", { name: "Create delivery field case" }).click();
      const open = page.getByRole("link", { name: "Open field case" });
      await expect(open).toBeVisible();
      fieldCasePath = new URL((await open.getAttribute("href")) ?? "", page.url()).pathname.replace(/^\/[^/]+/, "");
    });

    test("the team moves the delivery to Delivered", async ({ page }) => {
      await signInAs(page, "head_security@gce.local");
      await page.goto(`/head_security${fieldCasePath}`);
      for (const step of ["Dispatched", "In Transit", "Arriving", "Delivered"]) {
        await page.getByRole("button", { name: `Mark ${step}` }).click();
        await expect(page.getByText(`Marked ${step}.`)).toBeVisible();
      }
    });

    test("a legitimate decline queues the downpayment refund", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${txId}`);
      await page.getByRole("button", { name: /Declined — Legit/ }).click();
      await expect(page.getByText("Declined by Buyer").first()).toBeVisible();

      await signInAs(page, "head_accountant@gce.local");
      await page.goto("/head_accountant/finance");
      await expect(page.getByText("Downpayment refund").first()).toBeVisible();
    });
  });
