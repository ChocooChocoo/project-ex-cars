import { test } from "@playwright/test";

import {
  approveAsSalesManager,
  buyerRequest,
  db,
  expect,
  futureSlot,
  open,
  pick,
  pickByLabel,
  seedPassword,
  signInAs,
} from "./support/t01";
import { canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// T01 Phase 6, §7–9 (Phase 6 default until the client writes these sections): a bank-transfer purchase
// follows its Cash counterpart. §7: the car is marked sold only after the Head Accountant verifies the
// transfer. §9: the delivery terms ask for the balance by bank transfer. §8 reuses §3 unchanged.

test.describe
  .serial("T01 bank transfer", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    // A click that cannot land fails in a minute instead of holding the run until the test timeout.
    test.use({ actionTimeout: 60_000 });
    test.setTimeout(300_000);
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

    test("§7: a GCE visit paid by bank transfer is sold only once the transfer is verified", async ({ page }) => {
      const vehicleId = await createTestVehicle("BANK-VISIT");
      vehicleIds.push(vehicleId);
      await signInAs(page, "customer@gce.local");
      visitId = await buyerRequest(page, vehicleId, {
        method: "Bank Transfer",
        arrangement: "GCE Visit",
        when: futureSlot().replace(":00", ":25"),
      });
      await approveAsSalesManager(page, visitId);

      await page.locator("#pay_amount").fill("500000");
      await pick(page, "pay_method", "Bank Transfer");
      await page.getByRole("button", { name: "Record Payment" }).click();
      await expect(page.getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: /Mark Sold to This Buyer/ }).click();
      await expect(
        page.getByText("The Head Accountant must verify the bank transfer before the car is marked sold."),
      ).toBeVisible();

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${visitId}`);
      const verify = page.getByRole("button", { name: "Verify", exact: true });
      await expect(verify).toHaveCount(1);
      await verify.click();
      await expect(verify).toHaveCount(0);

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${visitId}`);
      await page.getByRole("button", { name: /Mark Sold to This Buyer/ }).click();
      await expect(page.getByText("Transaction moved to completed.")).toBeVisible();
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

      // Close the open request so later specs start clean.
      await db()
        .from("transactions")
        .update({ current_state: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", id);
    });
  });
