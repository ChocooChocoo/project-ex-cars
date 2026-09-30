import { type Page, test } from "@playwright/test";

import { db, expect, open, png, seedPassword, signInAs } from "./support/t01";
import { canCreateTestVehicle } from "./support/test-vehicle";

// T01 Selling (§1) branch: the inspection finds an issue → Inspection Issue Report → revised ceiling →
// CEO approves → the seller agrees → purchase funds requested and paid → the offer completes → the
// field expense is reimbursed once the car is sold. The resale is set through the service role (the
// resale flow itself is covered by the Phase 2 spec); every other step goes through the UI.

const tag = Math.floor(100 + Math.random() * 899);
const recalculated = 450_000 + tag; // unique amount, so the Finance row is easy to find
const expenseNote = `Fuel and toll ${tag}`;

async function pickNamed(page: Page, name: RegExp | string, option?: string) {
  await page.getByRole("combobox", { name }).click();
  await (option ? page.getByRole("option", { name: option }) : page.getByRole("option").first()).click();
}

async function financeRow(page: Page) {
  await open(page, page.url().replace(/\/[^/]*$/, "/finance"));
  await page.getByRole("tab", { name: /Disbursements/ }).click();
  return page
    .getByRole("row")
    .filter({ hasText: "Car purchase fund" })
    .filter({ hasText: `₱${recalculated.toLocaleString()}` });
}

test.describe
  .serial("T01 selling issue path", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    // A click that cannot land fails in a minute instead of holding the run until the test timeout.
    test.use({ actionTimeout: 60_000 });

    let transactionId = "";
    let casePath = "";

    test("seller submits; papers verified; ceiling approved; price agreed", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      await open(page, "/customer/sell-vehicle");
      await page.getByLabel("Make *").fill("Mitsubishi");
      await page.getByLabel("Model *").fill("Mirage");
      await page.getByLabel("Year *").fill("2018");
      await page.getByLabel("Mileage (km) *").fill("62000");
      await pickNamed(page, /^Condition/, "Fair");
      await page.getByLabel("Offered Amount (₱) *").fill("520000");
      await page.getByLabel("The vehicle has known issues").check();
      await page.getByLabel("Describe the issues *").fill("Aircon weak");
      await pickNamed(page, /^Meet-up method/, "Meet Halfway within Calabarzon");
      await page.getByLabel("Vehicle photos").setInputFiles(png("front.png"));
      await page.getByLabel("Valid ID #1 *").setInputFiles(png("id-1.png"));
      await page.getByLabel("Valid ID #2 *").setInputFiles(png("id-2.png"));
      await page.getByLabel("ORCR *").setInputFiles(png("orcr.png"));
      await page.getByLabel("Deed of Sale *").setInputFiles(png("deed.png"));
      await pickNamed(page, "ID type #1", "Passport");
      await pickNamed(page, "ID type #2", "Driver's License");
      await page.getByRole("button", { name: "Submit Vehicle", exact: true }).click();
      await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
      transactionId = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";

      await signInAs(page, "marketing_specialist@gce.local");
      await open(page, `/marketing_specialist/transactions/${transactionId}`);
      const verify = page.getByRole("button", { name: "Verify", exact: true });
      for (let left = 4; left > 0; left--) {
        await verify.first().click();
        await expect(verify).toHaveCount(left - 1);
      }
      await page.getByLabel("Purchase ceiling (₱)").fill("500000");
      await page.getByRole("button", { name: "Propose ceiling to CEO" }).click();
      await expect(page.getByText("Ceiling sent to the CEO.")).toBeVisible();

      await signInAs(page, "ceo@gce.local");
      await open(page, `/ceo/transactions/${transactionId}`);
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.getByText("Ceiling approved.")).toBeVisible();

      await signInAs(page, "marketing_specialist@gce.local");
      await open(page, `/marketing_specialist/transactions/${transactionId}`);
      await page.getByLabel(/^Agreed price/).fill("480000");
      await page.getByLabel("Meet-up date and time").fill("2033-01-15T10:00");
      await page.getByLabel("Meet-up location").fill("Petron SLEX Southbound");
      await pickNamed(page, "Confidential Informant");
      await pickNamed(page, "Mechanic (optional)");
      await page.getByRole("button", { name: "Create field case" }).click();
      await expect(page.getByText("Price recorded. Field case created.")).toBeVisible();
      const caseLink = page.getByRole("link", { name: "Open field case" });
      await expect(caseLink).toBeVisible();
      casePath = new URL((await caseLink.getAttribute("href")) ?? "", page.url()).pathname.replace(/^\/[^/]+/, "");
    });

    test("field team checks the seller and the car, finds an issue, and files expenses", async ({ page }) => {
      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await page.getByRole("button", { name: "Confirm identity" }).click();
      await expect(page.getByText("Identity confirmed.")).toBeVisible();
      await page.getByLabel("Expense amount").fill("850");
      await page.getByLabel("Expense description").fill(expenseNote);
      await page.getByLabel("Proof of expense").setInputFiles(png("receipt.png"));
      await page.getByRole("button", { name: "File expense" }).click();
      await expect(page.getByText("Expense filed.")).toBeVisible();

      await signInAs(page, "mechanic@gce.local");
      await open(page, `/mechanic${casePath}`);
      await page.getByRole("button", { name: "Confirm plate" }).click();
      await expect(page.getByText("Plate and chassis confirmed.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await pickNamed(page, "Inspection outcome", "Issue found");
      await page.locator("#issue").fill("Compressor failing; aircon needs overhaul");
      await page.locator("#estimate").fill("30000");
      await page.locator("#inspection-photos").setInputFiles(png("aircon.png"));
      await page.getByRole("button", { name: "Report inspection" }).click();
      await expect(page.getByText("Inspection reported.")).toBeVisible();
    });

    test("Inspection Issue Report → revised ceiling → CEO approves → seller agrees", async ({ page }) => {
      await signInAs(page, "marketing_specialist@gce.local");
      await open(page, `/marketing_specialist/transactions/${transactionId}`);
      await page.locator("#profitable").click();
      await page.getByRole("option", { name: "Still profitable" }).click();
      await page.locator("#profit-reason").fill("Resale margin holds after a ₱30,000 aircon overhaul.");
      await page.locator("#recalculated").fill(String(recalculated));
      await page.locator("#new-ceiling").fill("460000");
      await page.getByRole("button", { name: "Send to CEO" }).click();
      await expect(page.getByText("Revised ceiling sent to the CEO.")).toBeVisible();

      await signInAs(page, "ceo@gce.local");
      await open(page, `/ceo/transactions/${transactionId}`);
      await expect(page.getByText(/Revised ceiling/).first()).toBeVisible();
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.getByText("Ceiling approved.")).toBeVisible();

      await signInAs(page, "marketing_specialist@gce.local");
      await open(page, `/marketing_specialist/transactions/${transactionId}`);
      await page.getByRole("button", { name: "Seller agrees" }).click();
      await expect(page.getByText("Seller's agreement recorded.")).toBeVisible();
      await expect(page.getByText("Cleared for payment. Request the purchase funds in Finance.")).toBeVisible();
    });

    test("the seller is paid through Finance and the offer completes", async ({ page }) => {
      await signInAs(page, "account_manager@gce.local");
      await open(page, "/account_manager/finance");
      await page.getByRole("button", { name: "Request Purchase Funds" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("combobox").click();
      await page.getByRole("option", { name: new RegExp(`Seller payment · ${transactionId.slice(0, 8)}`) }).click();
      await dialog.getByRole("spinbutton").fill(String(recalculated));
      await dialog.getByRole("button", { name: "Submit Request" }).click();
      await expect(page.getByText("Purchase fund request created. Awaiting Head Accountant release.")).toBeVisible();

      await signInAs(page, "head_accountant@gce.local");
      await open(page, "/head_accountant/finance");
      const row = await financeRow(page);
      for (const step of ["Approve", "Release", "Receive", "Mark Paid"]) {
        await row.getByRole("button", { name: step, exact: true }).click();
        await expect(
          row.getByText(
            step === "Mark Paid"
              ? "paid"
              : step === "Receive"
                ? "received"
                : step === "Release"
                  ? "released"
                  : "approved",
            { exact: true },
          ),
        ).toBeVisible();
      }

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
        .eq("description", expenseNote);
      expect(rows?.[0]?.reimbursed_at).toBeTruthy();
    });
  });
