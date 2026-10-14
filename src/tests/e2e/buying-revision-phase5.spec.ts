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
import { createHmac } from "node:crypto";

// Buying-flow revision, Phases 5 and 7 (docs/implementation-plan/buying-flow-revision/phase-7.md): the buyer
// clicks Pay and lands on a PayMongo Checkout (test mode) for the exact amounts; PayMongo's webhook marks the
// payment paid. PayMongo cannot reach localhost, so the spec sends the webhook itself, signed with the
// webhook secret exactly as PayMongo signs it. Needs PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET.

const SECRET = process.env.PAYMONGO_SECRET_KEY ?? "";
const WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET ?? "";

// What PayMongo sends when the Checkout is paid.
async function paymongoPaid(page: Page, id: string) {
  const { data } = await db().from("payment_records").select("paymongo_checkout_id").eq("transaction_id", id);
  const checkoutId = data?.find((row) => row.paymongo_checkout_id)?.paymongo_checkout_id as string;
  const body = JSON.stringify({
    data: {
      id: `evt_${Date.now()}`,
      attributes: {
        type: "checkout_session.payment.paid",
        data: { id: checkoutId, attributes: { payments: [{ id: `pay_e2e_${Date.now()}` }] } },
      },
    },
  });
  const t = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
  const response = await page.request.post("/api/paymongo/webhook", {
    data: body,
    headers: { "Content-Type": "application/json", "Paymongo-Signature": `t=${t},te=${signature},li=` },
  });
  expect(response.status()).toBe(200);
}

async function paymentRows(id: string) {
  const { data } = await db()
    .from("payment_records")
    .select("payment_kind, amount, method, paid_at")
    .eq("transaction_id", id)
    .order("payment_kind");
  return data ?? [];
}

async function payOnline(page: Page) {
  await page.getByRole("button", { name: /^Pay ₱.* with PayMongo$/ }).click();
  await page.waitForURL((url) => url.hostname.endsWith("paymongo.com"), { timeout: 30_000 });
}

test.describe
  .serial("Buying revision phase 5", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle() || !SECRET || !WEBHOOK_SECRET,
      "SEED_USER_PASSWORD, the Supabase service role and the PayMongo test keys are required",
    );
    test.use({ actionTimeout: 60_000 });
    test.beforeAll(resetCustomerStanding);
    test.afterAll(async () => {
      await resetCustomerStanding();
      await archiveListedTestVehicles();
    });

    test("Scenario 3: Pay opens one Checkout and PayMongo's webhook marks both payments paid", async ({ page }) => {
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

      // Back on the request: both waiting for PayMongo, one Checkout for both rows.
      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText("Waiting for PayMongo")).toHaveCount(2);
      expect(await paymentRows(id)).toEqual([
        { payment_kind: "delivery_fee", amount: 2500, method: "paymongo", paid_at: null },
        { payment_kind: "downpayment", amount: 50000, method: "paymongo", paid_at: null },
      ]);
      // Pay again reopens the same Checkout and records nothing new.
      await payOnline(page);
      expect(await paymentRows(id)).toHaveLength(2);

      // PayMongo confirms: both rows paid, no Head Accountant click.
      await paymongoPaid(page, id);
      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText("Paid", { exact: true })).toHaveCount(2);
      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await expect(page.getByRole("cell", { name: "Delivery Fee" })).toBeVisible();
      await expect(page.getByText("Paid on PayMongo")).toHaveCount(2);
      await expect(page.getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
      await page.screenshot({ path: "test-results/phase7-head-accountant-desktop.png", fullPage: true });
    });

    test("Scenario 5: Pay is refused before signing, and the car is not sold before PayMongo confirms", async ({
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
        { payment_kind: "downpayment", amount: 100000, method: "paymongo", paid_at: null },
      ]);

      // Not paid on PayMongo yet: the car is not sold.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await page.getByRole("button", { name: /Mark Sold to This Buyer/ }).click();
      // Refused: the unverified PayMongo row does not count as a payment.
      await expect(page.getByText("Record the buyer's payment before marking the car sold.")).toBeVisible();
      const { data: still } = await db().from("transactions").select("current_state").eq("id", id).single();
      expect(still?.current_state).toBe("approved");

      // PayMongo confirms the downpayment; the Head Accountant opens the account without verifying by hand.
      await paymongoPaid(page, id);
      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await page.getByRole("button", { name: "Complete financing agreement" }).click();
      await expect(page.getByText("Financing account opened.")).toBeVisible();
    });
  });
