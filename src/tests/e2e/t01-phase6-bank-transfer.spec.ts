import { type Page, test } from "@playwright/test";

import {
  approveAsSalesManager,
  buyerRequest,
  db,
  expect,
  futureSlot,
  open,
  papersThenSold,
  pickByLabel,
  seedPassword,
  signInAs,
} from "./support/t01";
import { canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";
import { createHmac } from "node:crypto";

// T01 Phase 6, §7–9, then T06: a bank-transfer purchase follows its Cash counterpart, but the transfer is paid
// online through PayMongo. PayMongo cannot reach localhost, so the spec sends the webhook itself, signed with
// the webhook secret exactly as PayMongo signs it. Needs PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET.

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

test.describe
  .serial("T01 bank transfer", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle() || !SECRET || !WEBHOOK_SECRET,
      "SEED_USER_PASSWORD, the Supabase service role and the PayMongo test keys are required",
    );
    // A click that cannot land fails in a minute instead of holding the run until the test timeout.
    test.use({ actionTimeout: 60_000 });
    test.setTimeout(600_000);
    const vehicleIds: string[] = [];
    test.afterAll(async () => {
      if (vehicleIds.length) {
        await db()
          .from("vehicles")
          .update({ listing_state: "archived" })
          .in("id", vehicleIds)
          .eq("listing_state", "available");
      }
    });

    let visitId = "";

    test("an unfinished buyer request is hidden from the Sales Manager", async ({ page }) => {
      const vehicleId = await createTestVehicle("S7-DRAFT");
      vehicleIds.push(vehicleId);
      await signInAs(page, "customer@gce.local");
      await open(page, `/customer/showroom/${vehicleId}`);
      await page.getByRole("button", { name: "Buy Now" }).click();
      await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/);
      const id = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";
      await signInAs(page, "sales_manager@gce.local");
      await open(page, "/sales_manager/transactions");
      await expect(page.locator(`a[href$="/${id}"]`)).toHaveCount(0);
      await open(page, `/sales_manager/transactions/${id}`);
      await expect(page.getByText("Page not found", { exact: false })).toBeVisible();
      await db()
        .from("transactions")
        .update({ current_state: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", id);
    });

    test("§7: a GCE visit paid by bank transfer is sold once PayMongo confirms the transfer", async ({ page }) => {
      const vehicleId = await createTestVehicle("BANK-VISIT");
      vehicleIds.push(vehicleId);
      await signInAs(page, "customer@gce.local");
      visitId = await buyerRequest(page, vehicleId, {
        method: "Bank Transfer",
        arrangement: "GCE Visit",
        when: futureSlot(),
      });
      await approveAsSalesManager(page, visitId);

      // T06: staff no longer record a Bank Transfer by hand. The buyer pays it online instead.
      await page.locator("#pay_method").click();
      await expect(page.getByRole("option", { name: "Cash", exact: true })).toBeVisible();
      await expect(page.getByRole("option", { name: "Bank Transfer", exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");

      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${visitId}`);
      await page.getByRole("button", { name: "Pay by bank transfer (PayMongo)" }).click();
      await page.waitForURL((url) => url.hostname.endsWith("paymongo.com"), { timeout: 30_000 });
      await paymongoPaid(page, visitId);

      const { data: rows } = await db()
        .from("payment_records")
        .select("payment_kind, method, verified_by")
        .eq("transaction_id", visitId);
      expect(rows?.[0]?.payment_kind).toBe("balance");
      expect(rows?.[0]?.method).toBe("paymongo");
      expect(rows?.[0]?.verified_by).toBeTruthy();

      // Buying-flow revision Phase 2: the papers go through the CI before the sale.
      await papersThenSold(page, visitId, "E2E Test BANK-VISIT");
      const { data } = await db().from("transactions").select("current_state").eq("id", visitId).single();
      expect(data?.current_state).toBe("completed");
      const { data: vehicle } = await db().from("vehicles").select("listing_state").eq("id", vehicleId).single();
      expect(vehicle?.listing_state).toBe("sold");
      await signInAs(page, "customer@gce.local");
      await open(page, `/customer/my-transactions/${visitId}`);
      await expect(page.getByRole("article").getByText("₱0.00", { exact: true })).toBeVisible();
    });

    test("§9: a bank-transfer delivery asks for the balance by bank transfer", async ({ page }) => {
      const vehicleId = await createTestVehicle("BANK-DELIVERY");
      vehicleIds.push(vehicleId);
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, vehicleId, {
        method: "Bank Transfer",
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
      await open(page, `/customer/my-transactions/${id}`);
      await expect(page.getByText(/The balance is paid by bank transfer on delivery\./)).toBeVisible();
      // The fee and downpayment are paid online; the balance follows once the contract is signed.
      await expect(page.getByRole("button", { name: "Pay by bank transfer (PayMongo)" })).toBeVisible();

      // Close the open request so later specs start clean.
      await db()
        .from("transactions")
        .update({ current_state: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", id);
    });
  });
