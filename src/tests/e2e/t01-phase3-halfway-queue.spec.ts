import { expect as baseExpect, type Page, test } from "@playwright/test";

import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// The dev server compiles each route on first use, so a refresh after a server action can take
// longer than Playwright's default 5 s.
const expect = baseExpect.configure({ timeout: 20_000 });

// T01 Phase 3 — buyer queue + Cash Meet Halfway (GCE Process Flows §3):
// two requests for one car → the first is Active, the second On Hold → the Sales Manager rejects the
// Active one and promotes the next by hand → approves it and marks the car sold.
// The no-show path needs a meet-up 2h30m in the past, so it is covered by unit tests, not here.
// Needs migration 00051 applied; the spec lists its own E2E-T01 test car.

const seedPassword = process.env.SEED_USER_PASSWORD;

const png = (name: string) => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  ),
});

const meetup = "2031-06-15T14:00";

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
  // Wait for this upload's round trip and refresh, not an earlier upload's toast.
  await expect(uploadButton).toBeEnabled();
  await page.waitForLoadState("networkidle");
}

async function requestHalfway(page: Page, vehiclePath: string): Promise<string> {
  await page.goto(vehiclePath);
  await page.getByRole("button", { name: "Buy Now" }).click();
  await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const id = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";

  await upload(page, "Valid ID", "Passport");
  await upload(page, "Valid ID", "Driver's License");
  await upload(page, "Proof of Billing");
  await pick(page, "payment_method", "Cash");
  await pick(page, "arrangement_kind", "CALABARZON Meet-up");
  await page.locator("#schedule").fill(meetup);
  await page.locator("#location").fill("SM Calamba parking");
  await page.getByLabel(/I have reviewed this car's condition/).check();
  await page.getByRole("button", { name: "Save Details" }).click();
  await expect(page.getByText(/Condition acknowledged/)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Submit Request" }).click();
  await expect(page.getByText(/Request sent|yours is On Hold/)).toBeVisible();
  return id;
}

async function verifyAll(page: Page) {
  const verify = page.getByRole("button", { name: "Verify", exact: true });
  for (let left = await verify.count(); left > 0; left--) {
    await verify.first().click();
    await expect(verify).toHaveCount(left - 1);
  }
}

test.describe
  .serial("T01 Phase 3 halfway queue", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    test.afterAll(archiveListedTestVehicles);

    let firstId = "";
    let secondId = "";

    test("the first request is Active and the second waits On Hold", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      const vehiclePath = `/customer/showroom/${await createTestVehicle("HALFWAY")}`;

      firstId = await requestHalfway(page, vehiclePath);
      await expect(page.getByText("Pending Sales Manager Approval").first()).toBeVisible();

      secondId = await requestHalfway(page, vehiclePath);
      await expect(page.getByText("On Hold").first()).toBeVisible();
    });

    test("Sales Manager rejects the Active request and promotes the next by hand", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${secondId}`);
      await expect(page.getByRole("button", { name: "Make Active" })).toBeDisabled();

      await page.goto(`/sales_manager/transactions/${firstId}`);
      await page.getByRole("button", { name: /^Transition Reject/ }).click();
      await expect(page.getByText("Rejected").first()).toBeVisible();

      await page.goto(`/sales_manager/transactions/${secondId}`);
      await page.getByRole("button", { name: "Make Active" }).click();
      await expect(page.getByText("Pending Sales Manager Approval").first()).toBeVisible();
    });

    test("Sales Manager approves the promoted request and marks the car sold", async ({ page }) => {
      await signInAs(page, "sales_manager@gce.local");
      await page.goto(`/sales_manager/transactions/${secondId}`);
      await verifyAll(page);
      await page.getByRole("button", { name: /^Transition Approve/ }).click();
      await expect(page.getByRole("button", { name: /Declined — Not Legit/ })).toBeVisible();

      await page.locator("#pay_amount").fill("500000");
      await page.getByRole("button", { name: "Record Payment" }).click();
      await page.getByRole("button", { name: /Mark Sold to This Buyer/ }).click();
      await expect(page.getByText("Sold").first()).toBeVisible();
    });
  });
