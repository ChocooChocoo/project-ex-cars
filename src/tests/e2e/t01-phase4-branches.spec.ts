import { type Page, test } from "@playwright/test";

import {
  approveAsSalesManager,
  buyerRequest,
  customerId,
  db,
  expect,
  futureSlot,
  open,
  pick,
  pickByLabel,
  resetCustomerStanding,
  seedPassword,
  signInAs,
} from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// T01 branches for §4 (Cash Delivery) that the main spec does not walk: an address that cannot be
// served, a missed downpayment deadline, and a delivery that is rescheduled, runs late and finds the
// buyer unavailable (no-show, downpayment forfeited). The deadline is reached by backdating it through
// the service role; every flow step goes through the UI.

async function requestDelivery(page: Page, label: string): Promise<string> {
  await signInAs(page, "customer@gce.local");
  const id = await buyerRequest(page, await createTestVehicle(label), {
    method: "Cash",
    arrangement: "Delivery",
    when: futureSlot(),
  });
  await approveAsSalesManager(page, id);
  return id;
}

async function confirmTerms(page: Page) {
  await pickByLabel(page, "Address serviceable", "Yes, we can deliver");
  await page.getByLabel("Delivery fee (₱)").fill("2500");
  await page.getByLabel("Downpayment (₱)").fill("50000");
  await page.getByRole("button", { name: "Confirm and notify buyer" }).click();
  await expect(page.getByText("Delivery terms sent to the buyer.")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function state(transactionId: string) {
  const { data } = await db()
    .from("transactions")
    .select("current_state, flag, purchase_details(downpayment_forfeited_at)")
    .eq("id", transactionId)
    .single();
  return data;
}

test.describe
  .serial("T01 delivery branches", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    // A click that cannot land fails in a minute instead of holding the run until the test timeout.
    test.use({ actionTimeout: 60_000 });
    test.beforeAll(resetCustomerStanding);
    test.afterAll(async () => {
      await resetCustomerStanding();
      await archiveListedTestVehicles();
    });

    test("an address GCE cannot serve ends the request", async ({ page }) => {
      const id = await requestDelivery(page, "DELIVERY-UNSERVICEABLE");
      await pickByLabel(page, "Address serviceable", "No, not serviceable");
      await page.getByRole("button", { name: "Reject: not serviceable" }).click();
      await expect(page.getByText("Request closed: not serviceable.")).toBeVisible();
      expect((await state(id))?.current_state).toBe("rejected");
    });

    test("a missed downpayment deadline lets the Sales Manager cancel the request", async ({ page }) => {
      const id = await requestDelivery(page, "DELIVERY-DEADLINE");
      await confirmTerms(page);
      // Move the 3-working-day deadline into the past.
      await db()
        .from("purchase_details")
        .update({ downpayment_due_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
        .eq("transaction_id", id);

      await open(page, `/sales_manager/transactions/${id}`);
      await page.getByRole("button", { name: "Cancel: downpayment not paid" }).click();
      await expect(page.getByText("Request cancelled.")).toBeVisible();
      expect((await state(id))?.current_state).toBe("cancelled");
    });

    test("a rescheduled, late delivery with an absent buyer forfeits the downpayment", async ({ page }) => {
      // Seven sign-ins and a full delivery in one test: the default 120 s budget runs out on a dev server.
      test.slow();
      const id = await requestDelivery(page, "DELIVERY-UNAVAILABLE");
      await confirmTerms(page);

      // Head Accountant records and verifies the fee and the downpayment.
      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      const verify = page.getByRole("button", { name: "Verify", exact: true });
      for (const [kind, amount, expected] of [
        ["Delivery fee", "2500", 1],
        ["Downpayment", "50000", 2],
      ] as const) {
        await page.locator("#pay_amount").fill(amount);
        await pick(page, "pay_method", "Bank Transfer");
        await pick(page, "pay_kind", kind);
        await page.getByRole("button", { name: "Record Payment" }).click();
        await expect(verify).toHaveCount(expected);
      }
      for (let left = 2; left > 0; left--) {
        await verify.first().click();
        await expect(verify).toHaveCount(left - 1);
      }

      // The buyer asked in advance for a new date; the Sales Manager moves it and sends the team.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await page.getByLabel("New date and time").fill(futureSlot(30));
      await page.getByLabel("Fee (₱)").fill("500");
      await page.getByRole("button", { name: "Reschedule", exact: true }).click();
      await expect(page.getByText("Delivery rescheduled.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await pickByLabel(page, "Confidential Informant");
      await pickByLabel(page, "Mechanic");
      await pickByLabel(page, "Head Security");
      await page.getByRole("button", { name: "Create delivery field case" }).click();
      const caseLink = page.getByRole("link", { name: "Open field case" });
      await expect(caseLink).toBeVisible();
      const casePath = new URL((await caseLink.getAttribute("href")) ?? "", page.url()).pathname.replace(
        /^\/[^/]+/,
        "",
      );

      // The Informant reports a delay; the Sales Manager passes it to the buyer.
      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await page.getByLabel("Report a delay to the Sales Manager").fill("Heavy traffic on SLEX");
      await page.getByRole("button", { name: "Report delay" }).click();
      await expect(page.getByText("Delay reported.")).toBeVisible();

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await page.getByRole("button", { name: "Tell the buyer about the delay" }).click();
      await expect(page.getByText("Buyer told about the delay.")).toBeVisible();

      // The team drives out and arrives.
      await signInAs(page, "head_security@gce.local");
      await open(page, `/head_security${casePath}`);
      for (const step of ["Dispatched", "In Transit", "Arriving"]) {
        await page.getByRole("button", { name: `Mark ${step}` }).click();
        await expect(page.getByText(`Marked ${step}.`)).toBeVisible();
        await page.waitForLoadState("networkidle");
      }

      // Nobody is home: one no-show, downpayment forfeited.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await page.getByRole("button", { name: /Buyer unavailable/ }).click();
      await expect(page.getByText("Recorded: buyer didn't show up.")).toBeVisible();

      const after = await state(id);
      expect(after?.flag).toBe("buyer_unavailable");
      const details = Array.isArray(after?.purchase_details) ? after?.purchase_details[0] : after?.purchase_details;
      expect(details?.downpayment_forfeited_at).toBeTruthy();
      const { data: standing } = await db()
        .from("customer_standing")
        .select("no_show_count")
        .eq("account_id", await customerId())
        .single();
      expect(standing?.no_show_count).toBe(1);
    });
  });
