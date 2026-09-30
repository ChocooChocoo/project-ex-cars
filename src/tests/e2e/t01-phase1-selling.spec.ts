import { expect, type Page, test } from "@playwright/test";

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
}

async function pick(page: Page, combobox: string | RegExp, option?: string) {
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
      await page.getByLabel("Make *").fill("Toyota");
      await page.getByLabel("Model *").fill("Vios");
      await page.getByLabel("Year *").fill("2019");
      await page.getByLabel("Mileage (km) *").fill("40000");
      await pick(page, /^Condition/, "Good");
      await page.getByLabel("Offered Amount (₱) *").fill("520000");
      await page.getByLabel("There is no known issue").check();
      await pick(page, /^Meet-up method/, "GCE Visit");
      await page.getByLabel("Vehicle photos").setInputFiles(png("front.png"));
      await page.getByLabel("Valid ID #1 *").setInputFiles(png("id-1.png"));
      await page.getByLabel("Valid ID #2 *").setInputFiles(png("id-2.png"));
      await page.getByLabel("ORCR *").setInputFiles(png("orcr.png"));
      await page.getByLabel("Deed of Sale *").setInputFiles(png("deed.png"));
      await pick(page, "ID type #1", "Passport");
      await pick(page, "ID type #2", "Driver's License");
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

      for (let i = 0; i < 4; i++) {
        await page.getByRole("button", { name: "Verify", exact: true }).first().click();
        await expect(page.getByRole("button", { name: "Verify", exact: true })).toHaveCount(3 - i);
      }

      await page.getByLabel("Purchase ceiling (₱)").fill("500000");
      await page.getByRole("button", { name: "Propose ceiling to CEO" }).click();
      await expect(page.getByText("Pending CEO Approval").first()).toBeVisible();
    });

    test("CEO approves the ceiling without listing the seller's car", async ({ page }) => {
      await signInAs(page, "ceo@gce.local");
      await page.goto(`/ceo/transactions/${transactionId}`);
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.getByText(/₱500,000/).first()).toBeVisible();

      await page.goto("/ceo/vehicles");
      await expect(page.getByText("Purchase ceiling")).toHaveCount(0);
    });

    test("Marketing Specialist records the agreed price within the ceiling", async ({ page }) => {
      await signInAs(page, "marketing_specialist@gce.local");
      await page.goto(`/marketing_specialist/transactions/${transactionId}`);
      await expect(page.getByRole("link", { name: "Open negotiation chat" })).toBeVisible();

      await page.getByLabel(/^Agreed price/).fill("600000");
      await page.getByLabel("Meet-up date and time").fill("2030-01-15T10:00");
      await pick(page, "Confidential Informant");
      await pick(page, "Mechanic (optional)");
      await page.getByRole("button", { name: "Create field case" }).click();
      await expect(page.getByText(/within the approved ceiling/).first()).toBeVisible();

      await page.getByLabel(/^Agreed price/).fill("480000");
      await page.getByRole("button", { name: "Create field case" }).click();
      const caseLink = page.getByRole("link", { name: "Open field case" });
      await expect(caseLink).toBeVisible();
      fieldCasePath = new URL((await caseLink.getAttribute("href")) ?? "", page.url()).pathname.replace(/^\/[^/]+/, "");
    });

    test("Confidential Informant confirms identity and files the meet-up expense", async ({ page }) => {
      await signInAs(page, "confidential_informant@gce.local");
      await page.goto(`/confidential_informant${fieldCasePath}`);
      await page.getByRole("button", { name: "Confirm identity" }).click();
      await expect(page.getByRole("button", { name: "Confirm identity" })).toHaveCount(0);

      await page.getByLabel("Expense amount").fill("850");
      await page.getByLabel("Expense description").fill("Fuel and toll");
      await page.getByLabel("Proof of expense").setInputFiles(png("receipt.png"));
      await page.getByRole("button", { name: "File expense" }).click();
      await expect(page.getByText("Fuel and toll")).toBeVisible();
    });

    test("Mechanic confirms the plate and reports no issues", async ({ page }) => {
      await signInAs(page, "mechanic@gce.local");
      await page.goto(`/mechanic${fieldCasePath}`);
      await page.getByRole("button", { name: "Confirm plate" }).click();
      await pick(page, "Inspection outcome", "No issues found");
      await page.getByRole("button", { name: "Report inspection" }).click();
      await expect(page.getByText("No issues found. The car is cleared for payment.")).toBeVisible();
    });

    test("the cleared car is offered for the seller payment", async ({ page }) => {
      await signInAs(page, "ceo@gce.local");
      await page.goto(`/ceo/transactions/${transactionId}`);
      await expect(page.getByText("Cleared for payment. Request the purchase funds in Finance.")).toBeVisible();
    });
  });
