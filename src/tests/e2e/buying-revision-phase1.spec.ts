import { type Page, test } from "@playwright/test";

import {
  approveAsSalesManager,
  buyerRequest,
  db,
  expect,
  futureSlot,
  open,
  pick,
  pickByLabel,
  png,
  resetCustomerStanding,
  seedPassword,
  signInAs,
  verifyAll,
} from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// Buying-flow revision, Phase 1 (docs/implementation-plan/buying-flow-revision/phase-1.md): every
// schedule is on the hour, 9 AM to 9 PM, Monday to Saturday; a delivery needs 7 days' lead; and the
// Sales Manager opens each image and can ask for it to be resubmitted with a reason.

const SLOT_RULE = "Please choose a time on the hour, between 9 AM and 9 PM, Monday to Saturday.";
const LEAD_RULE = "Delivery must be scheduled at least 7 days after your request date.";

const pad = (n: number) => String(n).padStart(2, "0");
const local = (day: Date, time: string) =>
  `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${time}`;

// The first day on or after `from` that falls on the given weekday (0 is Sunday).
function dayOn(weekday: number, from: Date): Date {
  const day = new Date(from);
  while (day.getDay() !== weekday) day.setDate(day.getDate() + 1);
  return day;
}

const daysAhead = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const farTuesday = dayOn(2, new Date(2033, 2, 1));
const farSunday = dayOn(0, new Date(2033, 2, 1));

async function saveWith(page: Page, when: string) {
  await page.locator("#schedule").fill(when);
  await page.getByRole("button", { name: "Save Details" }).click();
}

test.describe
  .serial("Buying revision phase 1", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    test.use({ actionTimeout: 60_000 });
    // Earlier specs can leave the test customer limited to GCE visits.
    test.beforeAll(resetCustomerStanding);
    test.afterAll(archiveListedTestVehicles);

    test("visit, meet-up and delivery refuse times outside GCE's hours", async ({ page }) => {
      test.slow();
      await signInAs(page, "customer@gce.local");
      await open(page, `/customer/showroom/${await createTestVehicle("P1-SLOTS")}`);
      await page.getByRole("button", { name: "Buy Now" }).click();
      await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await pick(page, "payment_method", "Cash");

      for (const arrangement of ["GCE Visit", "CALABARZON Meet-up", "Delivery"] as const) {
        await pick(page, "arrangement_kind", arrangement);
        if (arrangement !== "GCE Visit") {
          await page.locator("#location").fill("SM Calamba parking, Laguna");
          const acknowledge = page.getByLabel(/I have reviewed this car's condition/);
          if (await acknowledge.isVisible()) await acknowledge.check();
        }
        for (const when of [
          local(farTuesday, "10:30"),
          local(farTuesday, "08:00"),
          local(farTuesday, "22:00"),
          local(farSunday, "10:00"),
        ]) {
          await saveWith(page, when);
          await expect(page.getByText(SLOT_RULE).last(), `${arrangement} at ${when}`).toBeVisible();
          await expect(page.getByText(SLOT_RULE)).toHaveCount(0, { timeout: 15_000 });
        }
      }

      // Still on Delivery: under 7 days is refused, a valid slot far enough ahead is saved.
      await saveWith(page, local(dayOn(2, daysAhead(1)), "10:00"));
      await expect(page.getByText(LEAD_RULE)).toBeVisible();
      await saveWith(page, local(farTuesday, "21:00"));
      await expect(page.getByText("Details saved.")).toBeVisible();
    });

    test("the Sales Manager opens an image and asks for a resubmission", async ({ page }) => {
      test.slow();
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P1-RESUBMIT"), {
        method: "Cash",
        arrangement: "GCE Visit",
        when: futureSlot(),
      });

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);

      // Each image opens in a larger view and closes with Escape.
      await page
        .getByRole("button", { name: /Open Valid ID document preview in a larger view/ })
        .first()
        .click();
      const larger = page.getByRole("dialog", { name: "Valid ID document preview" });
      await expect(larger).toBeVisible();
      await page.screenshot({ path: "test-results/phase1-larger-view-desktop.png" });
      await page.keyboard.press("Escape");
      await expect(larger).toBeHidden();

      // No reason, no request. T03 HA3: the reason is asked for in a modal.
      await page.getByRole("button", { name: "Ask to resubmit Valid ID" }).first().click();
      const resubmit = page.getByRole("dialog");
      const reason = resubmit.getByLabel("What to fix");
      const ask = resubmit.getByRole("button", { name: "Ask to resubmit" });
      await expect(ask).toBeDisabled();
      await reason.fill("The photo is blurred");
      await page.screenshot({ path: "test-results/phase1-resubmit-desktop.png", fullPage: true });
      await ask.click();
      await expect(page.getByText("Resubmission requested. The uploader is notified.")).toBeVisible();
      await page.waitForLoadState("networkidle");

      // The request cannot be approved while an image is waiting to be resubmitted.
      await verifyAll(page, 2);
      await page.getByRole("button", { name: /^Transition Approve/ }).click();
      await expect(page.getByText(/Two verified valid IDs and a verified proof of billing/)).toBeVisible();

      const { data: notice } = await db()
        .from("notifications")
        .select("body")
        .eq("reference_id", id)
        .eq("kind", "document_resubmission_requested");
      expect(notice?.[0]?.body).toContain("The photo is blurred");

      // The buyer sees what to fix and uploads a new image.
      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText(/What to fix: The photo is blurred/)).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "test-results/phase1-buyer-reason-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 });
      await pick(page, "cust-doc-kind", "Valid ID");
      await pick(page, "cust-doc-id-type", "Passport");
      await page.locator('input[type="file"]').last().setInputFiles(png("Valid ID again.png"));
      const upload = page.getByRole("button", { name: "Upload", exact: true });
      await upload.click();
      await expect(upload).toBeEnabled();
      await page.waitForLoadState("networkidle");

      // Once the new image is confirmed, the request is approved.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "test-results/phase1-resubmit-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 });
      await verifyAll(page, 1);
      await page.getByRole("button", { name: /^Transition Approve/ }).click();
      await expect(page.getByText("Transaction moved to approved.")).toBeVisible();
    });

    test("a delivery cannot be rescheduled to a Sunday or to under 7 days", async ({ page }) => {
      test.slow();
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P1-RESCHEDULE"), {
        method: "Cash",
        arrangement: "Delivery",
        when: futureSlot(),
      });
      await approveAsSalesManager(page, id);
      await pickByLabel(page, "Address serviceable", "Yes, we can deliver");
      await page.getByLabel("Delivery fee (₱)").fill("2500");
      await page.getByLabel("Downpayment (₱)").fill("50000");
      await page.getByRole("button", { name: "Confirm and notify buyer" }).click();
      await expect(page.getByText("Delivery terms sent to the buyer.")).toBeVisible();
      await page.waitForLoadState("networkidle");

      const reschedule = page.getByRole("button", { name: "Reschedule", exact: true });
      await page.getByLabel("Fee (₱)").fill("0");
      await page.getByLabel("New date and time").fill(local(farSunday, "10:00"));
      await reschedule.click();
      await expect(page.getByText(SLOT_RULE)).toBeVisible();

      await page.getByLabel("New date and time").fill(local(dayOn(2, daysAhead(1)), "10:00"));
      await reschedule.click();
      await expect(page.getByText(LEAD_RULE)).toBeVisible();
    });
  });
