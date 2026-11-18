import { expect as baseExpect, type Page, test } from "@playwright/test";

import {
  fillSlot,
  papersThenSold,
  recordVerifiedPayment,
  uploadBuyerBilling,
  uploadBuyerId,
  verifyAll,
} from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// The dev server compiles each route on first use, so a refresh after a server action can take
// longer than Playwright's default 5 s.
const expect = baseExpect.configure({ timeout: 20_000 });

// T01 Phase 2 — Buying Scenario 1, Cash Purchase: Onsite Visit (GCE Process Flows §2):
// buyer books a locked visit slot → a second request cannot take it → Sales Manager verifies and
// approves → payment recorded → Mark Sold to This Buyer (the other request closes) → Head Accountant
// sees the sale. Needs migration 00050 applied; the spec lists its own E2E-T01 test car.

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

// T03: the transition asks for confirmation first.
async function approve(page: Page) {
  await page.getByRole("button", { name: /^Transition Approve/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Approve", exact: true }).click();
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
  await fillSlot(page, slot);
  await page.getByRole("button", { name: "Save Details" }).click();
  await page.waitForLoadState("networkidle");
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
  // Wait for this upload's round trip and refresh, not an earlier upload's toast.
  await expect(uploadButton).toBeEnabled();
  await page.waitForLoadState("networkidle");
}

test.describe
  .serial("T01 Phase 2 cash onsite visit", () => {
    test.skip(!seedPassword || !canCreateTestVehicle(), "SEED_USER_PASSWORD and the local Laravel app are required");
    test.afterAll(archiveListedTestVehicles);

    let vehiclePath = "";
    let buyId = "";
    let rivalId = "";

    test("buyer books a locked slot and submits the request", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      vehiclePath = `/customer/showroom/${await createTestVehicle("ONSITE")}`;
      buyId = await startPurchase(page, vehiclePath);

      // T10: two IDs, each front and back, and the proof of billing.
      await uploadBuyerId(page, 0, "Passport", "Front");
      await uploadBuyerId(page, 0, "Passport", "Back");
      await uploadBuyerId(page, 1, "Driver's License", "Front");
      await uploadBuyerId(page, 1, "Driver's License", "Back");
      await uploadBuyerBilling(page);
      await bookCashVisit(page);
      await expect(page.getByText(/Visit slot locked for/)).toBeVisible();

      await page.getByRole("button", { name: "Submit Request" }).click();
      await expect(page.getByText(/Request sent/)).toBeVisible();
    });

    test("a second request cannot take the locked slot", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      rivalId = await startPurchase(page, vehiclePath);
      // T04: the picker no longer offers an hour another buyer holds (Laravel sends the taken slots); the
      // server's "slot taken" answer is covered by the backend ConcurrencyTest.
      await pick(page, "payment_method", "Cash");
      await pick(page, "arrangement_kind", "GCE Visit");
      const [date, time] = slot.split("T");
      const slotHour = Number(time.slice(0, 2));
      await page.locator("#schedule-date").fill(date);
      await page.locator("#schedule-hour").click();
      await expect(page.getByRole("option").first()).toBeVisible();
      await expect(
        page.getByRole("option", {
          name: `${slotHour % 12 === 0 ? 12 : slotHour % 12}:00 ${slotHour < 12 ? "AM" : "PM"}`,
          exact: true,
        }),
      ).toHaveCount(0);
      await page.keyboard.press("Escape");
    });

    test("Sales Manager verifies, approves and marks the car sold to this buyer", async ({ page }) => {
      test.slow();
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${buyId}`);

      // Scenario 1, also try: approving before the three documents are confirmed is refused.
      await page.waitForLoadState("networkidle");
      await approve(page);
      await expect(page.getByText(/Two verified valid IDs and a verified proof of billing are required/)).toBeVisible();

      await verifyAll(page, 5);
      await approve(page);
      await expect(page.getByText("Approved").first()).toBeVisible();
      await page.waitForLoadState("networkidle");

      // Payment recording and verification move to Laravel in Phase 6; until then a fixture records the
      // checked cash payment. The papers still go through the CI first.
      await recordVerifiedPayment(buyId, 500000);
      await papersThenSold(page, buyId, "E2E Test ONSITE");

      // The rival never submitted, so only the buyer can see it closed (00055).
      await signInAs(page, "customer@gce.local");
      await page.goto(`/customer/my-transactions/${rivalId}`);
      await expect(page.getByText("Cancelled").first()).toBeVisible();
    });

    // The finance records page moves to Laravel in Phase 7.
    test.fixme("Head Accountant sees the sale in the records", async ({ page }) => {
      await signInAs(page, "head_accountant@gce.local");
      await page.goto("/head_accountant/finance");
      await expect(page.getByText("Sale records")).toBeVisible();
      await expect(page.locator(`a[href$="/transactions/${buyId}"]`)).toBeVisible();
    });
  });
