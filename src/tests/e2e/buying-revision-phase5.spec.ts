import { type Page, test } from "@playwright/test";

import {
  approveAsSalesManager,
  buyerRequest,
  ceoConfirms,
  db,
  expect,
  futureSlot,
  headAccountantApproves,
  open,
  pickByLabel,
  proposeTerms,
  resetCustomerStanding,
  seedPassword,
  signInAs,
} from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// Buying-flow revision, Phase 5 (docs/implementation-plan/buying-flow-revision/phase-5.md): the buyer
// clicks Pay, is sent to GCE's PayMongo payment link, and the Head Accountant verifies the payment.
// Run against a dev server started with NEXT_PUBLIC_PAYMONGO_LINK set; the spec skips otherwise.

const LINK = process.env.NEXT_PUBLIC_PAYMONGO_LINK ?? "";

async function paymentRows(id: string) {
  const { data } = await db()
    .from("payment_records")
    .select("payment_kind, amount, method, verified_by")
    .eq("transaction_id", id)
    .order("payment_kind");
  return data ?? [];
}

async function payOnline(page: Page) {
  await page.getByRole("button", { name: /^Pay ₱.* with PayMongo$/ }).click();
  await page.waitForURL((url) => url.href.startsWith(LINK), { timeout: 30_000 });
}

test.describe
  .serial("Buying revision phase 5", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle() || !LINK,
      "SEED_USER_PASSWORD, the Supabase service role and NEXT_PUBLIC_PAYMONGO_LINK are required",
    );
    test.use({ actionTimeout: 60_000 });
    test.beforeAll(resetCustomerStanding);
    test.afterAll(async () => {
      await resetCustomerStanding();
      await archiveListedTestVehicles();
    });

    test("Scenario 3: Pay opens the link once and the Head Accountant verifies the labelled rows", async ({ page }) => {
      test.slow();
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P5-DELIVERY"), {
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

      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText("Not paid")).toHaveCount(2);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "test-results/phase5-pay-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 });
      await payOnline(page);

      // Back on the request: both sent, nothing left to pay, and no second set of rows.
      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText("Sent, waiting for the Head Accountant")).toHaveCount(2);
      await expect(page.getByRole("button", { name: /with PayMongo$/ })).toHaveCount(0);
      expect(await paymentRows(id)).toEqual([
        { payment_kind: "delivery_fee", amount: 2500, method: "paymongo", verified_by: null },
        { payment_kind: "downpayment", amount: 50000, method: "paymongo", verified_by: null },
      ]);

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await expect(page.getByRole("cell", { name: "Delivery Fee" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "Downpayment" })).toBeVisible();
      await page.screenshot({ path: "test-results/phase5-head-accountant-desktop.png", fullPage: true });
      const verify = page.getByRole("button", { name: "Verify", exact: true });
      await expect(verify).toHaveCount(2);
      for (let left = 2; left > 0; left--) {
        await verify.first().click();
        await expect(verify).toHaveCount(left - 1);
      }

      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText("Verified", { exact: true })).toHaveCount(2);
    });

    test("Scenario 5: Pay is refused before signing, and the car is not sold before the payment is verified", async ({
      page,
    }) => {
      test.setTimeout(900_000);
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P5-FINANCE"), {
        method: "Financing",
        arrangement: "GCE Visit",
      });
      await approveAsSalesManager(page, id);
      await proposeTerms(page, 12, 500000, 100000);
      await headAccountantApproves(page, id);
      await ceoConfirms(page, id);

      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await page.getByLabel("GCE visit date and time").fill(futureSlot());
      await page.getByRole("button", { name: "Accept and book visit" }).click();
      await expect(page.getByText(/Visit booked/)).toBeVisible();

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await page.getByRole("button", { name: "Record Purchase Claim" }).click();
      await expect(page.getByText("Purchase Claim recorded.")).toBeVisible();
      await page.getByRole("button", { name: "Start from the pre-made contract" }).click();
      await page.getByRole("button", { name: "Send for approval" }).click();
      await expect(page.getByText("Contract sent to the Head Accountant.")).toBeVisible();

      // Not signed yet: Pay is refused and nothing is recorded.
      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await page.getByRole("button", { name: "Pay ₱100,000.00 with PayMongo" }).click();
      await expect(page.getByText("Sign the contract before paying.")).toBeVisible();
      expect(await paymentRows(id)).toEqual([]);

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await page.getByRole("button", { name: "Approve contract" }).click();
      await expect(page.getByText("Contract approved. The buyer can sign it.")).toBeVisible();

      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await page.getByLabel("Type your full name to sign").fill("Maria Santos");
      await page.getByRole("button", { name: "Sign contract" }).click();
      await expect(page.getByText("Contract signed.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await payOnline(page);
      expect(await paymentRows(id)).toEqual([
        { payment_kind: "downpayment", amount: 100000, method: "paymongo", verified_by: null },
      ]);

      // Sent but not verified: the car is not sold.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await page.getByRole("button", { name: /Mark Sold to This Buyer/ }).click();
      // Refused: the unverified PayMongo row does not count as a payment.
      await expect(page.getByText("Record the buyer's payment before marking the car sold.")).toBeVisible();
      const { data: still } = await db().from("transactions").select("current_state").eq("id", id).single();
      expect(still?.current_state).toBe("approved");

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await page.getByRole("button", { name: "Verify", exact: true }).click();
      await expect(page.getByText("Payment verified.")).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: "Complete financing agreement" }).click();
      await expect(page.getByText("Financing account opened.")).toBeVisible();
    });
  });
