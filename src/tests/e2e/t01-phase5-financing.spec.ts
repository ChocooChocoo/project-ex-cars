import { expect as baseExpect, type Page, test } from "@playwright/test";

import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// The dev server compiles each route on first use, so a refresh after a server action can take
// longer than Playwright's default 5 s.
const expect = baseExpect.configure({ timeout: 20_000 });

// T01 Phase 5 — In-House Financing, GCE visit (GCE Process Flows §6), phases A–C:
// buyer asks for financing → Sales Manager approves and proposes terms → Head Accountant approves →
// CEO confirms → buyer accepts and books the visit → Purchase Claim → Initial Downpayment recorded and
// verified → agreement opens the account → car marked sold. Installments, repossession and
// reconditioning are covered by unit tests. Needs migration 00054 applied; the spec lists its own
// E2E-T01 test car.

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
const visit = `2032-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(Math.random() * 27)).padStart(2, "0")}T${String(9 + Math.floor(Math.random() * 8)).padStart(2, "0")}:00`;

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

async function pick(page: Page, id: string, option: string) {
  await page.locator(`#${id}`).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function upload(page: Page, kind: "Valid ID" | "Proof of Billing", idType?: string) {
  await pick(page, "cust-doc-kind", kind);
  if (idType) await pick(page, "cust-doc-id-type", idType);
  await page
    .locator('input[type="file"]')
    .last()
    .setInputFiles(png(`${kind}.png`));
  const uploadButton = page.getByRole("button", { name: "Upload", exact: true });
  await uploadButton.click();
  await expect(uploadButton).toBeEnabled();
  await page.waitForLoadState("networkidle");
}

async function verifyAll(page: Page, expected: number) {
  const verify = page.getByRole("button", { name: "Verify", exact: true });
  await expect(verify).toHaveCount(expected);
  for (let left = expected; left > 0; left--) {
    await verify.first().click();
    await expect(verify).toHaveCount(left - 1);
  }
}

test.describe
  .serial("T01 Phase 5 in-house financing", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    test.afterAll(archiveListedTestVehicles);

    let txId = "";

    test("buyer asks for In-House Financing", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      await page.goto(`/customer/showroom/${await createTestVehicle("FINANCING")}`);
      await page.getByRole("button", { name: "Buy Now" }).click();
      await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
      txId = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";

      await upload(page, "Valid ID", "Passport");
      await upload(page, "Valid ID", "Driver's License");
      await upload(page, "Proof of Billing");
      await pick(page, "payment_method", "Financing");
      await pick(page, "arrangement_kind", "GCE Visit");
      await page.getByLabel(/I have reviewed this car's condition/).check();
      await page.getByRole("button", { name: "Save Details" }).click();
      await expect(page.getByText("Details saved.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Submit Request" }).click();
      await expect(page.getByText(/Request sent|yours is On Hold/)).toBeVisible();
    });

    test("Sales Manager approves the request and proposes the terms", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${txId}`);
      await verifyAll(page, 3);
      await page.getByRole("button", { name: /^Transition Approve/ }).click();

      await page.getByLabel("Payment duration (months)").fill("12");
      await page.getByLabel("Vehicle price (₱)").fill("500000");
      await page.getByLabel("Initial Downpayment (₱)").fill("100000");
      await page.getByLabel("First installment due").fill("2032-12-01");
      await page.getByRole("button", { name: "Send to Head Accountant" }).click();
      await expect(page.getByText("Waiting for the Head Accountant")).toBeVisible();
    });

    test("Head Accountant approves and the CEO confirms", async ({ page }) => {
      await signInAs(page, "head_accountant@gce.local");
      await page.goto(`/head_accountant/transactions/${txId}`);
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.getByText("Waiting for the CEO")).toBeVisible();

      await signInAs(page, "ceo@gce.local");
      await page.goto(`/ceo/transactions/${txId}`);
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    });

    test("buyer accepts the offer and books the inspection visit", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      await page.goto(`/customer/my-transactions/${txId}`);
      await expect(page.getByText("Your approved financing")).toBeVisible();
      // Fill only after hydration, or React never sees the value.
      await page.waitForLoadState("networkidle");
      await page.getByLabel("GCE visit (on the hour)").fill(visit);
      await expect(page.getByRole("button", { name: "Accept and book visit" })).toBeEnabled();
      await page.getByRole("button", { name: "Accept and book visit" }).click();
      await expect(page.getByText(/Visit booked/)).toBeVisible();
    });

    test("Sales Manager records the Purchase Claim and the Initial Downpayment", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${txId}`);
      await page.getByRole("button", { name: "Record Purchase Claim" }).click();
      await expect(page.getByText(/Record the Initial Downpayment under Record payment/)).toBeVisible();

      await page.locator("#pay_amount").fill("100000");
      await pick(page, "pay_method", "Bank Transfer");
      await pick(page, "pay_kind", "Downpayment");
      await page.getByRole("button", { name: "Record Payment" }).click();
      await expect(page.getByText("Payment recorded.")).toBeVisible();
    });

    test("Head Accountant verifies the downpayment and completes the agreement", async ({ page }) => {
      await signInAs(page, "head_accountant@gce.local");
      await page.goto(`/head_accountant/transactions/${txId}`);
      await verifyAll(page, 1);
      await page.getByRole("button", { name: "Complete financing agreement" }).click();
      await expect(page.getByText("Financing account", { exact: true })).toBeVisible();
    });

    test("Sales Manager marks the financed car sold", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${txId}`);
      await page.getByRole("button", { name: /Mark Sold to This Buyer/ }).click();
      await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();

      // The buyer sees the financing as active, not simply "Sold".
      await signInAs(page, "customer@gce.local");
      await page.goto(`/customer/my-transactions/${txId}`);
      await expect(page.getByText("In-House Financing — Active").first()).toBeVisible();
    });
  });
