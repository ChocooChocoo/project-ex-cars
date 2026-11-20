import { type Page, test } from "@playwright/test";

import { db, expect, open, png, seedPassword, signInAs, verifyAll } from "./support/t01";
import { canCreateTestVehicle } from "./support/test-vehicle";

// T01 Selling (§1) branch: the inspection finds a hidden issue → Inspection Issue Report → revised ceiling →
// CEO approves → second negotiation records the final price → the CI's purchase funds are released and the seller
// is paid → the offer completes → the field expense is reimbursed once the car is sold. The resale is set through
// the Laravel test fixtures (the resale flow itself is covered by the Phase 2 spec); every other step goes through
// the UI.

const tag = Math.floor(100 + Math.random() * 899);
const finalPrice = 450_000 + tag; // unique amount, so the Finance row is easy to find
const travel = 850;
const expenseNote = `Fuel and toll ${tag}`;

async function pickNamed(page: Page, name: RegExp | string, option?: string | RegExp) {
  await page.getByRole("combobox", { name }).click();
  await (option ? page.getByRole("option", { name: option }) : page.getByRole("option").first()).click();
}

// Clicks a flow button and, when it asks "Are you sure", confirms in the dialog.
async function press(page: Page, name: string | RegExp) {
  await page.getByRole("button", typeof name === "string" ? { name, exact: true } : { name }).click();
  const dialog = page.getByRole("alertdialog");
  if (await dialog.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await dialog.getByRole("button").last().click();
    await expect(dialog).toBeHidden();
  }
}

async function financeRow(page: Page) {
  await open(page, page.url().replace(/\/[^/]*$/, "/finance"));
  await page.getByRole("tab", { name: /Disbursements/ }).click();
  return page
    .getByRole("row")
    .filter({ hasText: "Car purchase fund" })
    .filter({ hasText: `₱${(finalPrice + travel).toLocaleString()}` });
}

test.describe
  .serial("T01 selling issue path", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Laravel test fixtures (e2e:fixture) are required",
    );
    // A click that cannot land fails in a minute instead of holding the run until the test timeout.
    // T12: Meet Halfway sets its map point from the device location (Bacoor, Cavite here).
    test.use({
      actionTimeout: 60_000,
      permissions: ["geolocation"],
      geolocation: { latitude: 14.4624, longitude: 120.9645 },
    });

    let transactionId = "";
    let casePath = "";

    test("seller submits; papers verified; ceiling approved; price agreed", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      await open(page, "/customer/sell-vehicle");
      await page.getByLabel("Brand *").fill("Mitsubishi");
      await page.getByLabel("Model *").fill("Mirage");
      await page.keyboard.press("Escape");
      await page.getByRole("spinbutton", { name: /^Year/ }).fill("2018");
      await page.getByLabel("Mileage (km) *").fill("62000");
      await pickNamed(page, /^Condition/, /^Good/);
      await pickNamed(page, /^Owner number/, "2nd owner");
      await page.getByLabel("Offered Amount (₱) *").fill("520000");
      await page.getByLabel("The vehicle has known issues").check();
      await page.getByLabel("Others", { exact: true }).check();
      await page.getByLabel("Describe the other issues *").fill("Aircon weak");
      await pickNamed(page, /^Meet-up method/, "Meet Halfway within Calabarzon");
      await page.getByLabel("Vehicle photos").setInputFiles(png("front.png"));
      // T10: two IDs, each front and back. SN-13: the OR, the CR and the deed of sale are a checklist now.
      await pickNamed(page, "ID type #1", "Passport");
      await pickNamed(page, "ID type #2", "Driver's License");
      for (const n of [1, 2]) {
        await page.getByLabel(`Front of ID #${n}`).setInputFiles(png(`id-${n}-front.png`));
        await page.getByLabel(`Back of ID #${n}`).setInputFiles(png(`id-${n}-back.png`));
      }
      await pickNamed(page, "Official Receipt (OR) *", "I have it");
      await pickNamed(page, "Certificate of Registration (CR) *", "I have it");
      await pickNamed(page, "Deed of Sale *", "I have it");
      await press(page, "Submit Vehicle");
      await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
      transactionId = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";

      await signInAs(page, "marketing_specialist@gce.local");
      await open(page, `/marketing_specialist/transactions/${transactionId}`);
      await verifyAll(page, 4);
      await page.getByLabel("Purchase ceiling (₱)").fill("500000");
      await press(page, "Propose ceiling to CEO");
      await expect(page.getByText("Ceiling sent to the CEO.")).toBeVisible();

      await signInAs(page, "ceo@gce.local");
      await open(page, `/ceo/transactions/${transactionId}`);
      await press(page, "Approve");
      await expect(page.getByText("Ceiling approved.")).toBeVisible();

      await signInAs(page, "marketing_specialist@gce.local");
      await open(page, `/marketing_specialist/transactions/${transactionId}`);
      await page.getByLabel(/^Agreed price/).fill("480000");
      await page.getByLabel("Meet-up date and time").fill("2033-01-15T10:00");
      // SH-12: the meet-up point is the seller's pin, shown read-only.
      await pickNamed(page, "Confidential Informant");
      await pickNamed(page, "Mechanic");
      await press(page, "Create field case");
      await expect(page.getByText("Price recorded. Field case created.")).toBeVisible();
      const caseLink = page.getByRole("link", { name: "Open field case" });
      await expect(caseLink).toBeVisible();
      casePath = new URL((await caseLink.getAttribute("href")) ?? "", page.url()).pathname.replace(/^\/[^/]+/, "");
    });

    test("field team checks the seller and the car, finds an issue, and files expenses", async ({ page }) => {
      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await press(page, "Confirm identity");
      await expect(page.getByText("Identity confirmed.")).toBeVisible();
      // BH-5: the purpose is a category checklist; "Other" carries the unique note this spec looks for later.
      await page.getByLabel("Expense amount").fill(String(travel));
      await page.getByLabel("Other", { exact: true }).check();
      await page.getByLabel("Other expense").fill(expenseNote);
      await page.getByLabel("Receipt photo").setInputFiles(png("receipt.png"));
      await press(page, "File expense");
      await expect(page.getByText("Expense filed.")).toBeVisible();

      await signInAs(page, "mechanic@gce.local");
      await open(page, `/mechanic${casePath}`);
      await press(page, "Confirm plate");
      await expect(page.getByText("Plate and chassis confirmed.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      // SH-7: every part is answered; one needs repair, with its cost and a photo (a hidden issue).
      for (const part of await page.getByRole("button", { name: "Good condition", exact: true }).all()) {
        await part.click();
      }
      await page.getByRole("button", { name: "Needs repair", exact: true }).first().click();
      await page.locator('[id^="repair-cost-"]').first().fill("30000");
      await page.locator('[id^="repair-note-"]').first().fill("Compressor failing; aircon needs overhaul");
      await page.locator('[id^="repair-photos-"]').first().setInputFiles(png("aircon.png"));
      await press(page, "Report inspection");
      await expect(page.getByText("Inspection reported.")).toBeVisible();
    });

    test("Inspection Issue Report → revised ceiling → CEO approves → second negotiation", async ({ page }) => {
      await signInAs(page, "marketing_specialist@gce.local");
      await open(page, `/marketing_specialist/transactions/${transactionId}`);
      await page.locator("#profitable").click();
      await page.getByRole("option", { name: "Still profitable" }).click();
      await page.locator("#profit-reason").fill("Resale margin holds after a ₱30,000 aircon overhaul.");
      await page.locator("#new-ceiling").fill("460000");
      await page.locator("#seller-remarks").fill("The aircon compressor needs replacing before resale.");
      await press(page, "Send to CEO");
      await expect(page.getByText("Revised ceiling sent to the CEO.")).toBeVisible();

      await signInAs(page, "ceo@gce.local");
      await open(page, `/ceo/transactions/${transactionId}`);
      await expect(page.getByText(/Revised ceiling/).first()).toBeVisible();
      await press(page, "Approve");
      await expect(page.getByText("Ceiling approved.")).toBeVisible();

      // SH-6: the seller sees GCE's remarks, never the ceiling.
      await signInAs(page, "customer@gce.local");
      await open(page, `/customer/my-transactions/${transactionId}`);
      const counter = page.getByRole("region", { name: "GCE counter-offer" });
      await expect(counter).toContainText("The aircon compressor needs replacing before resale.");
      await expect(counter).not.toContainText("460,000");

      // The approved revised ceiling is a maximum: the Marketing Specialist records the price the seller accepted.
      await signInAs(page, "marketing_specialist@gce.local");
      await open(page, `/marketing_specialist/transactions/${transactionId}`);
      await page.locator("#negotiated-price").fill("461000");
      await expect(page.getByText(/The agreed price cannot exceed the approved ceiling/)).toBeVisible();
      await page.locator("#negotiated-price").fill(String(finalPrice));
      await press(page, "Seller agrees");
      await expect(page.getByText("Agreed price recorded.")).toBeVisible();
      await expect(page.getByText("Cleared for payment. The fund requester pays the seller.")).toBeVisible();
    });

    test("the CI's purchase funds are released, the seller is paid and the offer completes", async ({ page }) => {
      // On a Meet Halfway the assigned Confidential Informant requests the car payment plus the travel estimate.
      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await page.locator("#travel-budget").fill(String(travel));
      await press(page, "Request funds");
      await expect(page.getByText("Funds requested from the Head Accountant.")).toBeVisible();

      await signInAs(page, "head_accountant@gce.local");
      for (const [step, done] of [
        ["Approve", "approved"],
        ["Release", "released"],
      ] as const) {
        await open(page, "/head_accountant/finance");
        const row = await financeRow(page);
        await row.getByRole("button", { name: "Open Car purchase fund" }).click();
        await page.getByRole("dialog").getByRole("button", { name: step, exact: true }).click();
        await expect(page.getByText(`Disbursement ${done}.`)).toBeVisible();
      }

      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await press(page, /^Record seller paid/);
      await expect(page.getByText("Seller payment recorded.")).toBeVisible();

      const { data } = await db().from("transactions").select("current_state").eq("id", transactionId).single();
      expect(data?.current_state).toBe("completed");
    });

    test("the field expense is reimbursed once the car is sold on", async ({ page }) => {
      // Simulate the resale of the bought car (the resale flow is covered by the Phase 2 spec).
      const { data: tx } = await db().from("transactions").select("vehicle_id").eq("id", transactionId).single();
      await db()
        .from("vehicles")
        .update({ listing_state: "sold" })
        .eq("id", tx?.vehicle_id as string);

      await signInAs(page, "head_accountant@gce.local");
      await open(page, "/head_accountant/finance");
      const expense = page
        .locator("div")
        .filter({ hasText: expenseNote })
        .filter({ has: page.getByRole("button", { name: "Mark reimbursed" }) })
        .last();
      await expense.getByRole("button", { name: "Mark reimbursed" }).click();
      await expect(page.getByText("Expense reimbursed.")).toBeVisible();

      const { data: rows } = await db()
        .from("field_case_expenses")
        .select("reimbursed_at")
        .eq("description", `Other: ${expenseNote}`);
      expect(rows?.[0]?.reimbursed_at).toBeTruthy();
    });
  });
