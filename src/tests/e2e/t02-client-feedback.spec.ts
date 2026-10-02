import { test } from "@playwright/test";

import { buyerRequest, expect, futureSlot, open, resetCustomerStanding, seedPassword, signInAs } from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// T02 client feedback: a Buy Now request reaches staff only once the buyer submits it.
// Needs migration 00055 applied. The 2 MB fixtures in buyerRequest also cover the stuck "Uploading…".

test.describe
  .serial("T02 client feedback", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    test.use({ actionTimeout: 60_000 });
    test.beforeAll(resetCustomerStanding);
    test.afterAll(archiveListedTestVehicles);

    test("the Sales Manager sees a buy request only after Submit Request", async ({ page }) => {
      const vehicleId = await createTestVehicle("T02-DRAFT");
      await signInAs(page, "customer@gce.local");
      await open(page, `/customer/showroom/${vehicleId}`);
      await page.getByRole("button", { name: "Buy Now" }).click();
      await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
      const draftId = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";

      const submittedId = await buyerRequest(page, vehicleId, {
        method: "Cash",
        arrangement: "GCE Visit",
        when: futureSlot(),
      });

      await signInAs(page, "sales_manager@gce.local");
      expect((await page.goto(`/sales_manager/transactions/${draftId}`))?.status()).toBe(404);
      expect((await page.goto(`/sales_manager/transactions/${submittedId}`))?.status()).toBe(200);
    });
  });
