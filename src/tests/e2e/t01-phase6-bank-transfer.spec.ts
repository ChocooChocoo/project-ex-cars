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
  resetCustomerStanding,
  seedPassword,
  signInAs,
} from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

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
    test.beforeAll(resetCustomerStanding);
    test.afterAll(archiveListedTestVehicles);

    let visitId = "";

    test("§7: a GCE visit paid by bank transfer is sold only once the transfer is verified", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      visitId = await buyerRequest(page, await createTestVehicle("BANK-VISIT"), {
        method: "Bank Transfer",
        arrangement: "GCE Visit",
        when: futureSlot(),
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
    });

    test("§9: a bank-transfer delivery asks for the balance by bank transfer", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("BANK-DELIVERY"), {
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
