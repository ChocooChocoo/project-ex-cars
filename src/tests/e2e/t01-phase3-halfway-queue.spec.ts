import { test } from "@playwright/test";

import {
  approveAsSalesManager,
  buyerRequest,
  ciClosesFieldCase,
  expect,
  fieldCasePath,
  futureSlot,
  markSold,
  open,
  recordPayment,
  seedPassword,
  signInAs,
  verifyPayments,
} from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// T01 Phase 3 — buyer queue + Cash Meet Halfway (GCE Process Flows §3, client doc Scenario 2):
// two requests for one car → the first is Active, the second On Hold → the Sales Manager rejects the
// Active one and promotes the next by hand → approves it with its team, the meet-up runs (papers,
// Buyer Met, paper contract, both copies, cash) and the car is marked sold.
// The no-show path is in t01-phase2-3-branches.spec.ts.

test.describe
  .serial("T01 Phase 3 halfway queue", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    test.use({ actionTimeout: 60_000 });
    test.afterAll(archiveListedTestVehicles);

    const meetup = futureSlot();
    let firstId = "";
    let secondId = "";

    test("the first request is Active and the second waits On Hold", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      const vehicleId = await createTestVehicle("HALFWAY");
      const halfway = { method: "Cash", arrangement: "CALABARZON Meet-up", when: meetup } as const;

      firstId = await buyerRequest(page, vehicleId, halfway);
      await expect(page.getByText("Pending Sales Manager Approval").first()).toBeVisible();

      secondId = await buyerRequest(page, vehicleId, halfway);
      await expect(page.getByText("On Hold").first()).toBeVisible();
    });

    test("Sales Manager rejects the Active request and promotes the next by hand", async ({ page }) => {
      test.slow();
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${secondId}`);
      await expect(page.getByRole("button", { name: "Make Active" })).toBeDisabled();

      await open(page, `/sales_manager/transactions/${firstId}`);
      await page.getByRole("button", { name: /^Transition Reject/ }).click();
      await expect(page.getByText("Rejected").first()).toBeVisible();

      await open(page, `/sales_manager/transactions/${secondId}`);
      await page.getByRole("button", { name: "Make Active" }).click();
      await expect(page.getByText("Pending Sales Manager Approval").first()).toBeVisible();
    });

    test("Sales Manager approves the promoted request, the meet-up runs and the car is sold", async ({ page }) => {
      test.setTimeout(600_000);
      await approveAsSalesManager(page, secondId);
      const casePath = await fieldCasePath(page);

      // Scenario 2 step 6: paper contract signed at the meet-up, both copies kept, cash reported.
      await ciClosesFieldCase(page, casePath, { cash: true, mechanicCopy: true });

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${secondId}`);
      await recordPayment(page, "500000", "Cash", "Full payment");
      await expect(page.getByText("Payment recorded.")).toBeVisible();
      await verifyPayments(page, secondId);

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${secondId}`);
      await markSold(page).click();
      await expect(page.getByText("Transaction moved to completed.")).toBeVisible();
    });
  });
