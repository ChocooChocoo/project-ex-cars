import { test } from "@playwright/test";

import {
  approveAsSalesManager,
  buyerRequest,
  customerId,
  db,
  expect,
  futureSlot,
  open,
  resetCustomerStanding,
  seedPassword,
  signInAs,
} from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// T01 branches for §2 (onsite visit) and §3 (Meet Halfway) that the main specs do not walk:
// a rejection frees the slot, an onsite decline, the 5-hour cancellation cut-off, no-shows leading to
// the GCE-Visit-only restriction, and a Not Legit decline. Time-based rules are reached by backdating
// the meet-up through the service role; every flow step itself goes through the UI.

async function backdateMeetup(transactionId: string, when: Date) {
  await db()
    .from("viewing_arrangements")
    .update({ schedule: when.toISOString() })
    .eq("purchase_transaction_id", transactionId)
    .in("confirmation_state", ["pending", "confirmed"]);
}

async function standing() {
  const { data } = await db()
    .from("customer_standing")
    .select("no_show_count, strike_count, gce_visit_only")
    .eq("account_id", await customerId())
    .maybeSingle();
  return data;
}

test.describe
  .serial("T01 onsite and halfway branches", () => {
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

    const slot = futureSlot();
    let onsiteCar = "";
    let halfwayId = "";

    test("§2: rejecting a request frees its visit slot for the next buyer", async ({ page }) => {
      onsiteCar = await createTestVehicle("ONSITE-REJECT");
      await signInAs(page, "customer@gce.local");
      const first = await buyerRequest(page, onsiteCar, { method: "Cash", arrangement: "GCE Visit", when: slot });

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${first}`);
      await page.getByRole("button", { name: /^Transition Reject/ }).click();
      await expect(page.getByText("Transaction moved to rejected.")).toBeVisible();

      // The same car and time can be booked again.
      await signInAs(page, "customer@gce.local");
      await buyerRequest(page, onsiteCar, { method: "Cash", arrangement: "GCE Visit", when: slot });
    });

    test("§2: an onsite buyer who declines closes the request and the car stays listed", async ({ page }) => {
      const { data } = await db()
        .from("transactions")
        .select("id")
        .eq("vehicle_id", onsiteCar)
        .eq("current_state", "under_review")
        .single();
      await approveAsSalesManager(page, data?.id as string);
      await page.getByRole("button", { name: /Buyer declined/ }).click();
      await expect(page.getByText("Recorded: declined by buyer.")).toBeVisible();

      const { data: car } = await db().from("vehicles").select("listing_state").eq("id", onsiteCar).single();
      expect(car?.listing_state).toBe("available");
    });

    test("§3: a buyer cannot cancel a meet-up less than 5 hours away", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      halfwayId = await buyerRequest(page, await createTestVehicle("HALFWAY-CUTOFF"), {
        method: "Cash",
        arrangement: "CALABARZON Meet-up",
        when: futureSlot(),
      });
      await backdateMeetup(halfwayId, new Date(Date.now() + 2 * 60 * 60 * 1000));

      await open(page, `/customer/my-transactions/${halfwayId}`);
      await page.getByRole("button", { name: "Cancel Transaction" }).click();
      await page.getByRole("button", { name: "Yes, Cancel Transaction" }).click();
      await expect(
        page.getByText("Cancellation is only allowed 5 hours or more before the scheduled time."),
      ).toBeVisible();
    });

    test("§3: a buyer who does not show up within 2h30m gets a no-show", async ({ page }) => {
      await approveAsSalesManager(page, halfwayId);
      await backdateMeetup(halfwayId, new Date(Date.now() - 3 * 60 * 60 * 1000));
      await open(page, `/sales_manager/transactions/${halfwayId}`);
      await page.getByRole("button", { name: /Buyer didn't show up/ }).click();
      await expect(page.getByText("Recorded: buyer didn't show up.")).toBeVisible();
      expect((await standing())?.no_show_count).toBe(1);
    });

    test("§3: a second no-show limits the buyer to GCE visits", async ({ page }) => {
      await signInAs(page, "customer@gce.local");
      const second = await buyerRequest(page, await createTestVehicle("HALFWAY-NOSHOW"), {
        method: "Cash",
        arrangement: "CALABARZON Meet-up",
        when: futureSlot(),
      });
      await approveAsSalesManager(page, second);
      await backdateMeetup(second, new Date(Date.now() - 3 * 60 * 60 * 1000));
      await open(page, `/sales_manager/transactions/${second}`);
      await page.getByRole("button", { name: /Buyer didn't show up/ }).click();
      await expect(page.getByText("Recorded: buyer didn't show up.")).toBeVisible();

      const now = await standing();
      expect(now?.no_show_count).toBe(2);
      expect(now?.gce_visit_only).toBe(true);

      // The buyer no longer sees Meet-up or Delivery.
      await signInAs(page, "customer@gce.local");
      await open(page, `/customer/showroom/${await createTestVehicle("RESTRICTED")}`);
      await page.getByRole("button", { name: "Buy Now" }).click();
      await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/limited to GCE visits/)).toBeVisible();
      await page.locator("#arrangement_kind").click();
      await expect(page.getByRole("option", { name: "GCE Visit", exact: true })).toBeVisible();
      await expect(page.getByRole("option", { name: "CALABARZON Meet-up" })).toHaveCount(0);
      await page.keyboard.press("Escape");
    });

    test("§3: a Not Legit decline is a strike and limits the buyer at once", async ({ page }) => {
      await resetCustomerStanding();
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("HALFWAY-DECLINE"), {
        method: "Cash",
        arrangement: "CALABARZON Meet-up",
        when: futureSlot(),
      });
      await approveAsSalesManager(page, id);
      await page.getByRole("button", { name: /Declined — Not Legit/ }).click();
      await expect(page.getByText("Recorded: declined by buyer.")).toBeVisible();

      const now = await standing();
      expect(now?.strike_count).toBe(1);
      expect(now?.gce_visit_only).toBe(true);
    });
  });
