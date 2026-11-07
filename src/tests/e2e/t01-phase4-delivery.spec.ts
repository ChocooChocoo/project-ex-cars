import { expect as baseExpect, type Page, test } from "@playwright/test";

import { recordDeliveryPayments, uploadBuyerBilling, uploadBuyerId, verifyAll } from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// The dev server compiles each route on first use, so a refresh after a server action can take
// longer than Playwright's default 5 s.
const expect = baseExpect.configure({ timeout: 20_000 });

// T01 Phase 4 — Cash Purchase: Delivery (GCE Process Flows §4):
// buyer asks for delivery → Sales Manager approves and sets the fee and downpayment → Head Accountant
// records and verifies both → delivery team (CI, Head Security) is created → the team moves
// the status to Arriving → the buyer declines for a legitimate reason, which queues a refund.
// T07 CR1: declines are recorded before hand-over; a Delivered car offers no decline outcome, so this
// spec stops at Arriving. Delivered itself is covered by buying-revision-phase3/4.
// The missed-deadline path needs a deadline in the past, so it is covered by unit tests, not here.
// Needs migration 00052 applied (the spec lists its own E2E-T01 test car) and active CI and Head Security accounts
// (the first of each in the worker directory must be the seeded @gce.local account).

const seedPassword = process.env.SEED_USER_PASSWORD;

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

test.describe
  .serial("T01 Phase 4 cash delivery", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    test.afterAll(archiveListedTestVehicles);

    let txId = "";
    let fieldCasePath = "";

    test("buyer asks for delivery", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      await page.goto(`/customer/showroom/${await createTestVehicle("DELIVERY")}`);
      await page.getByRole("button", { name: "Buy Now" }).click();
      await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
      txId = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";

      await uploadBuyerId(page, 0, "Passport", "Front");
      await uploadBuyerId(page, 0, "Passport", "Back");
      await uploadBuyerId(page, 1, "Driver's License", "Front");
      await uploadBuyerId(page, 1, "Driver's License", "Back");
      await uploadBuyerBilling(page);
      await pickById(page, "payment_method", "Cash");
      await pickById(page, "arrangement_kind", "Delivery");
      await page.locator("#schedule-date").fill("2031-08-20");
      await page.locator("#schedule-hour").click();
      await page.getByRole("option", { name: "10:00 AM", exact: true }).click();
      await page.locator("#location").fill("123 Rizal St, Calamba, Laguna");
      await page.getByLabel(/I have reviewed this car's condition/).check();
      // Buying-flow revision Phase 4: the buyer agrees to the delivery terms notice.
      await page.locator("#agree-delivery-terms").check();
      await page.getByRole("button", { name: "Save Details" }).click();
      await expect(page.getByText("Details saved.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Submit Request" }).click();
      await expect(page.getByText(/Request sent|yours is On Hold/)).toBeVisible();
    });

    test("Sales Manager approves and confirms the delivery terms", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${txId}`);
      await verifyAll(page, await page.getByRole("button", { name: "Verify", exact: true }).count());
      await page.getByRole("button", { name: /^Transition Approve/ }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Approve", exact: true }).click();

      await pickByLabel(page, "Address serviceable", "Yes, we can deliver");
      const feeInput = page.getByLabel("Delivery fee (₱)");
      if (await feeInput.count()) await feeInput.fill("2500");
      await page.getByRole("button", { name: "Confirm and notify buyer" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByText("Delivery terms sent to the buyer.")).toBeVisible();
    });

    test("Head Accountant records and verifies the fee and downpayment", async ({ page }) => {
      await recordDeliveryPayments(txId);
      await signInAs(page, "head_accountant@gce.local");
      await page.goto(`/head_accountant/transactions/${txId}`);
      await expect(page.getByText(/Delivery fee/).first()).toBeVisible();
      await expect(page.getByText(/verified/).first()).toBeVisible();
    });

    test("Sales Manager creates the delivery team", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${txId}`);
      await pickByLabel(page, "Confidential Informant");
      await pickByLabel(page, "Head Security");
      await page.getByRole("button", { name: "Create delivery field case" }).click();
      const open = page.getByRole("link", { name: "Open field case" });
      await expect(open).toBeVisible();
      fieldCasePath = new URL((await open.getAttribute("href")) ?? "", page.url()).pathname.replace(/^\/[^/]+/, "");

      // Scenario 3, also try: the car cannot be marked sold before it is delivered.
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: /Mark Sold to This Buyer/ }).click();
      await expect(page.getByText("Mark the car sold after the delivery team reports it delivered.")).toBeVisible();
    });

    test("the team moves the delivery to Arriving", async ({ page }) => {
      // Buying-flow revision Phase 2: the assigned CI records the papers before dispatch.
      await signInAs(page, "confidential_informant@gce.local");
      await page.goto(`/confidential_informant${fieldCasePath}`);
      await page.getByRole("button", { name: "Record papers released to me" }).click();
      await expect(page.getByText("Papers recorded as released to you.")).toBeVisible();

      await signInAs(page, "head_security@gce.local");
      await page.goto(`/head_security${fieldCasePath}`);
      for (const step of ["Dispatched", "In Transit", "Arriving"]) {
        await page.getByRole("button", { name: `Mark ${step}` }).click();
        await expect(page.getByText(`Marked ${step}.`)).toBeVisible();
        await page.waitForLoadState("networkidle");
      }
    });

    test("a legitimate decline queues the downpayment refund", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${txId}`);
      await page.getByRole("button", { name: /Declined — Legit/ }).click();
      await expect(page.getByText("Declined by Buyer").first()).toBeVisible();

      await signInAs(page, "head_accountant@gce.local");
      await page.goto("/head_accountant/finance");
      await page.getByRole("tab", { name: /Disbursements/ }).click();
      await expect(page.getByText("Downpayment refund").first()).toBeVisible();
    });
  });
