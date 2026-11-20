import { expect as baseExpect, type Page, test } from "@playwright/test";

import { finishOnboarding, verifyAll } from "./support/t01";

// The dev server compiles each route on first use, so a refresh after a server action can take
// longer than Playwright's default 5 s.
const expect = baseExpect.configure({ timeout: 20_000 });

// T01 Phase 1 — Selling Scenario (GCE Process Flows §1), no-issue path:
// seller submits → Marketing Specialist verifies and proposes → CEO approves → price agreed →
// field team checks, inspects and files expenses → car cleared for payment.
// Needs migration 00049 applied and the seeded role accounts, each with at least one
// active Confidential Informant and Mechanic in the worker directory.

const seedPassword = process.env.SEED_USER_PASSWORD;

// 1×1 transparent PNG.
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
  await finishOnboarding(page);
}

// Clicks a button and, when it asks "Are you sure", confirms in the dialog (T03 confirmations came after this spec).
async function press(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  if (await dialog.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await dialog.getByRole("button").last().click();
    await expect(dialog).toBeHidden();
  }
}

async function pick(page: Page, combobox: string | RegExp, option?: string | RegExp) {
  await page.getByRole("combobox", { name: combobox }).click();
  const choice = option ? page.getByRole("option", { name: option }) : page.getByRole("option").first();
  await choice.click();
}

test.describe
  .serial("T01 Phase 1 selling scenario", () => {
    test.skip(!seedPassword, "SEED_USER_PASSWORD required");

    let transactionId = "";
    let fieldCasePath = "";

    test("seller submits the car with the declaration, meet-up method and papers", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      await page.goto("/customer/sell-vehicle");
      await page.getByLabel("Brand *").fill("Toyota");
      await page.getByLabel("Model *").fill("Vios");
      await page.keyboard.press("Escape");
      await page.getByRole("spinbutton", { name: /^Year/ }).fill("2019");
      await page.getByLabel("Mileage (km) *").fill("40000");
      await pick(page, /^Condition/, /^Good/);
      await pick(page, /^Owner number/, "1st owner");
      await page.getByLabel("Offered Amount (₱) *").fill("520000");
      await page.getByLabel("There is no known issue").check();
      await pick(page, /^Meet-up method/, "GCE Visit");
      await page.getByLabel("Vehicle photos").setInputFiles(png("front.png"));
      // T10: two IDs, each front and back (the ID type unlocks its file inputs). SN-13: the OR, the CR and
      // the deed of sale are declared on a checklist now, not uploaded — the originals are checked at the meet-up.
      await pick(page, "ID type #1", "Passport");
      await pick(page, "ID type #2", "Driver's License");
      for (const n of [1, 2]) {
        await page.getByLabel(`Front of ID #${n}`).setInputFiles(png(`id-${n}-front.png`));
        await page.getByLabel(`Back of ID #${n}`).setInputFiles(png(`id-${n}-back.png`));
      }
      await pick(page, "Official Receipt (OR) *", "I have it");
      await pick(page, "Certificate of Registration (CR) *", "I have it");
      await pick(page, "Deed of Sale *", "I have it");
      await page.getByRole("button", { name: "Submit Vehicle", exact: true }).click();

      await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
      transactionId = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";
      expect(transactionId).not.toBe("");
      await expect(page.getByRole("link", { name: "Chat with GCE" })).toBeVisible();
    });

    test("Marketing Specialist verifies the papers and proposes the ceiling", async ({ page }) => {
      await signInAs(page, "marketing_specialist@gce.local");
      await page.goto(`/marketing_specialist/transactions/${transactionId}`);
      await expect(page.getByRole("button", { name: "Propose ceiling to CEO" })).toBeDisabled();

      // SN-11: only the four ID images need verifying now (the photos are attachments, verified on upload).
      await verifyAll(page, 4);

      await page.getByLabel("Purchase ceiling (₱)").fill("500000");
      await press(page, "Propose ceiling to CEO");
      await expect(page.getByText("Pending CEO Approval").first()).toBeVisible();
    });

    // The car staying unlisted (D3) is covered by approve-price.ceiling.test.ts.
    test("CEO approves the ceiling", async ({ page }) => {
      await signInAs(page, "ceo@gce.local");
      await page.goto(`/ceo/transactions/${transactionId}`);
      await press(page, "Approve");
      await expect(page.getByText("Step 5: negotiate in the chat within the ceiling")).toBeVisible();
      await expect(page.getByText("approved", { exact: true }).first()).toBeVisible();
    });

    test("Marketing Specialist records the agreed price within the ceiling", async ({ page }) => {
      await signInAs(page, "marketing_specialist@gce.local");
      await page.goto(`/marketing_specialist/transactions/${transactionId}`);
      await expect(page.getByRole("link", { name: "Open negotiation chat" })).toBeVisible();

      await page.getByLabel(/^Agreed price/).fill("600000");
      await page.getByLabel("Meet-up date and time").fill("2030-01-15T10:00");
      // T10: a GCE Visit sends only the Mechanic, who also confirms the seller's identity.
      await pick(page, "Mechanic for the visit day");
      await press(page, "Create field case");
      await expect(page.getByText(/within the approved ceiling/).first()).toBeVisible();

      await page.getByLabel(/^Agreed price/).fill("480000");
      await press(page, "Create field case");
      const caseLink = page.getByRole("link", { name: "Open field case" });
      await expect(caseLink).toBeVisible();
      fieldCasePath = new URL((await caseLink.getAttribute("href")) ?? "", page.url()).pathname.replace(/^\/[^/]+/, "");
    });

    test("Mechanic confirms identity and files the meet-up expense", async ({ page }) => {
      await signInAs(page, "mechanic@gce.local");
      await page.goto(`/mechanic${fieldCasePath}`);
      await press(page, "Confirm identity");
      await expect(page.getByRole("button", { name: "Confirm identity" })).toHaveCount(0);

      await page.getByLabel("Expense amount").fill("850");
      await page.getByLabel("Expense purpose").fill("Fuel and toll");
      await page.getByLabel("Receipt photo").setInputFiles(png("receipt.png"));
      await press(page, "File expense");
      await expect(page.getByText("Fuel and toll")).toBeVisible();
    });

    test("Mechanic confirms the plate and reports no issues", async ({ page }) => {
      await signInAs(page, "mechanic@gce.local");
      await page.goto(`/mechanic${fieldCasePath}`);
      await press(page, "Confirm plate");
      await pick(page, "Inspection outcome", "No issues found");
      await press(page, "Report inspection");
      await expect(page.getByText("No issues found. The car is cleared for payment.")).toBeVisible();
    });

    test("the cleared car is offered for the seller payment", async ({ page }) => {
      await signInAs(page, "ceo@gce.local");
      await page.goto(`/ceo/transactions/${transactionId}`);
      await expect(page.getByText("Cleared for payment. The fund requester pays the seller.")).toBeVisible();
    });
  });
