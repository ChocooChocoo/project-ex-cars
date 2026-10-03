import { test } from "@playwright/test";

import {
  approveAsSalesManager,
  buyerRequest,
  ceoConfirms,
  db,
  expect,
  futureSlot,
  headAccountantApproves,
  open,
  pick,
  proposeTerms,
  seedPassword,
  signInAs,
  verifyAll,
} from "./support/t01";
import { canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

test.describe("Scenario 8 financing meet-up", () => {
  test.skip(!seedPassword || !canCreateTestVehicle(), "Test credentials and Supabase service role are required");
  test.setTimeout(480_000);
  test.use({ actionTimeout: 60_000 });
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

  test("unfinished request stays hidden from the Sales Manager", async ({ page }) => {
    const vehicleId = await createTestVehicle("S8-DRAFT");
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

  test("financing is approved, meet-up booked and sale completed after downpayment verification", async ({ page }) => {
    const vehicleId = await createTestVehicle("S8-MEETUP");
    vehicleIds.push(vehicleId);
    await signInAs(page, "customer@gce.local");
    const id = await buyerRequest(page, vehicleId, { method: "Financing", arrangement: "CALABARZON Meet-up" });
    await approveAsSalesManager(page, id);
    await proposeTerms(page, 12, 500_000, 100_000);
    await headAccountantApproves(page, id);
    await ceoConfirms(page, id);

    await signInAs(page, "customer@gce.local");
    await open(page, `/customer/my-transactions/${id}`);
    await page.getByLabel("Meet-up date and time").fill(futureSlot().replace(":00", ":25"));
    await page.getByLabel("Meet-up location (Calabarzon)").fill("SM Calamba parking, Laguna");
    await page.getByRole("button", { name: "Accept and book meet-up" }).click();
    await expect(page.getByText("Meet-up booked. No payment is taken before you inspect the car.")).toBeVisible();
    const { data: payments, error: paymentsError } = await db()
      .from("payment_records")
      .select("id")
      .eq("transaction_id", id);
    expect(paymentsError).toBeNull();
    expect(payments).toHaveLength(0);

    const { data: arrangement, error: arrangementError } = await db()
      .from("viewing_arrangements")
      .select("id, schedule")
      .eq("purchase_transaction_id", id)
      .in("confirmation_state", ["pending", "confirmed"])
      .single();
    expect(arrangementError).toBeNull();
    expect(arrangement).not.toBeNull();
    if (!arrangement) throw new Error("Meet-up arrangement missing");
    try {
      const { error } = await db()
        .from("viewing_arrangements")
        .update({ schedule: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() })
        .eq("id", arrangement.id);
      expect(error).toBeNull();
      await open(page, `/customer/my-transactions/${id}`);
      await page.getByRole("button", { name: "Cancel Transaction", exact: true }).click();
      await page.getByRole("button", { name: "Yes, Cancel Transaction", exact: true }).click();
      await expect(
        page.getByText("Cancellation is only allowed 5 hours or more before the scheduled time."),
      ).toBeVisible();
    } finally {
      const { error } = await db()
        .from("viewing_arrangements")
        .update({ schedule: arrangement.schedule })
        .eq("id", arrangement.id);
      expect(error).toBeNull();
    }

    await signInAs(page, "sales_manager@gce.local");
    await open(page, `/sales_manager/transactions/${id}`);
    await expect(page.getByRole("button", { name: /Buyer didn't show up/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Record Purchase Claim" }).click();
    await expect(page.getByText("Purchase Claim recorded.")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.locator("#pay_amount").fill("100000");
    await pick(page, "pay_method", "Bank Transfer");
    await pick(page, "pay_kind", "Downpayment");
    await page.getByRole("button", { name: "Record Payment" }).click();
    await expect(page.getByText("Payment recorded.").last()).toBeVisible();

    await signInAs(page, "head_accountant@gce.local");
    await open(page, `/head_accountant/transactions/${id}`);
    await expect(page.getByRole("button", { name: "Complete financing agreement" })).toHaveCount(0);
    await verifyAll(page, 1);
    await page.getByRole("button", { name: "Complete financing agreement" }).click();
    await expect(page.getByText("Financing account opened.")).toBeVisible();

    await signInAs(page, "sales_manager@gce.local");
    await open(page, `/sales_manager/transactions/${id}`);
    await page.getByRole("button", { name: /Mark Sold to This Buyer/ }).click();
    await expect(page.getByText("Transaction moved to completed.")).toBeVisible();
    const { data: transaction } = await db()
      .from("transactions")
      .select("current_state, flow_status")
      .eq("id", id)
      .single();
    expect(transaction).toEqual({ current_state: "completed", flow_status: "financing_active" });
    const { data: vehicle } = await db().from("vehicles").select("listing_state").eq("id", vehicleId).single();
    expect(vehicle?.listing_state).toBe("sold");
    await signInAs(page, "customer@gce.local");
    await open(page, `/customer/my-transactions/${id}`);
    await expect(page.getByText("In-House Financing — Active", { exact: true })).toBeVisible();
  });
});
