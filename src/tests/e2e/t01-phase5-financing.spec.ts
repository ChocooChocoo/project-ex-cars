import { expect as baseExpect, type Page, test } from "@playwright/test";

import {
  buyerSignsContract,
  futureSlot,
  markFinancingFullyPaid,
  papersThenSold,
  recordFinancingDownpayment,
  uploadBuyerBilling,
  uploadBuyerId,
  writeAndApproveContract,
} from "./support/t01";
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

// A whole-hour slot, Monday to Saturday (futureSlot skips Sundays).
const visit = futureSlot();

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

async function verifyAllDocuments(page: Page, expected: number) {
  const documents = page.getByRole("list", { name: "Customer documents" });
  const verify = documents.getByRole("button", { name: "Verify", exact: true });
  await expect(verify).toHaveCount(expected);
  for (let left = expected; left > 0; left--) {
    await verify.first().click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(dialog).toBeHidden();
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

      await uploadBuyerId(page, 0, "Passport", "Front");
      await uploadBuyerId(page, 0, "Passport", "Back");
      await uploadBuyerId(page, 1, "Driver's License", "Front");
      await uploadBuyerId(page, 1, "Driver's License", "Back");
      await uploadBuyerBilling(page);
      await pick(page, "payment_option", "Financing");
      await pick(page, "arrangement_kind", "GCE Visit");
      await pick(page, "requested_term", "1 year");
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
      await verifyAllDocuments(page, 5);
      await page.getByRole("button", { name: /^Transition Approve/ }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Approve", exact: true }).click();
      await page.waitForLoadState("networkidle");

      await page.locator("#fin-price").fill("500000");
      await page.locator("#fin-first-due").fill("2032-12-01");
      await page.getByRole("button", { name: "Send to Head Accountant" }).click();
      await expect(page.getByText("Terms sent to the Head Accountant.")).toBeVisible();
    });

    test("Head Accountant approves and the CEO confirms", async ({ page }) => {
      await signInAs(page, "head_accountant@gce.local");
      await page.goto(`/head_accountant/transactions/${txId}`);
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.getByText("Terms sent to the CEO.")).toBeVisible();

      await signInAs(page, "ceo@gce.local");
      await page.goto(`/ceo/transactions/${txId}`);
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByText("Financing confirmed; the buyer is notified.")).toBeVisible();
    });

    test("buyer accepts the offer and books the inspection visit", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      await page.goto(`/customer/my-transactions/${txId}`);
      await expect(page.getByText("Your approved financing")).toBeVisible();
      // Fill only after hydration, or React never sees the value.
      await page.waitForLoadState("networkidle");
      const [visitDate, visitTime] = visit.split("T");
      const visitHour = Number(visitTime.slice(0, 2));
      const visitLabel = `${visitHour % 12 || 12}:00 ${visitHour < 12 ? "AM" : "PM"}`;
      await page.locator("#financing-visit-date").fill(visitDate);
      await page.locator("#financing-visit-hour").click();
      await page.getByRole("option", { name: visitLabel, exact: true }).click();
      await expect(page.getByRole("button", { name: "Accept and book visit" })).toBeEnabled();
      await page.getByRole("button", { name: "Accept and book visit" }).click();
      await expect(page.getByText(/Visit booked/)).toBeVisible();
    });

    test("Sales Manager records the Purchase Claim and the Initial Downpayment", async ({ page }) => {
      test.slow();
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${txId}`);
      await page.getByRole("button", { name: "Record Purchase Claim" }).click();
      await expect(page.getByText("Purchase Claim").first()).toBeVisible();
      await page.waitForLoadState("networkidle");

      // Buying-flow revision Phase 3: the contract is approved and signed before money is recorded.
      await writeAndApproveContract(page, txId);
      await buyerSignsContract(page, txId);

      // PayMongo checkout is external, so record the same verified downpayment the customer would create.
      await recordFinancingDownpayment(txId);
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${txId}`);
      await expect(page.getByText("Initial Downpayment — Confirmed")).toBeVisible();
    });

    test("Head Accountant verifies the downpayment and completes the agreement", async ({ page }) => {
      await signInAs(page, "head_accountant@gce.local");
      await page.goto(`/head_accountant/transactions/${txId}`);
      await page.getByRole("button", { name: "Complete financing agreement" }).click();
      await expect(page.getByText("Financing account", { exact: true })).toBeVisible();
    });

    test("Sales Manager marks the financed car sold", async ({ page }) => {
      test.slow();
      // T07: the car can be sold only after every installment is paid or waived.
      await markFinancingFullyPaid(txId);
      // Buying-flow revision Phase 2: the papers go through the CI before the sale.
      await papersThenSold(page, txId, "E2E Test FINANCING");

      // The buyer sees the financing as completed, not simply "Sold".
      await signInAs(page, "customer@gce.local");
      await page.goto(`/customer/my-transactions/${txId}`);
      await expect(page.getByText("In-House Financing — Completed").first()).toBeVisible();
    });
  });
