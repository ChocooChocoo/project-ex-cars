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
  pickByLabel,
  proposeTerms,
  seedPassword,
  signInAs,
  verifyAll,
} from "./support/t01";
import { canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

test.describe("Scenario 9 financing delivery", () => {
  test.skip(!seedPassword || !canCreateTestVehicle(), "Test credentials and Supabase service role are required");
  test.setTimeout(600_000);
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
    const vehicleId = await createTestVehicle("S9-DRAFT");
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

  test("delivery financing follows all eight artifact steps", async ({ page }) => {
    const vehicleId = await createTestVehicle("S9-DELIVERY");
    vehicleIds.push(vehicleId);
    await signInAs(page, "customer@gce.local");
    const id = await buyerRequest(page, vehicleId, { method: "Financing", arrangement: "Delivery" });
    await approveAsSalesManager(page, id);
    await proposeTerms(page, 12, 500_000, 100_000);
    await headAccountantApproves(page, id);
    await ceoConfirms(page, id);
    await signInAs(page, "sales_manager@gce.local");
    await open(page, `/sales_manager/transactions/${id}`);
    await expect(
      page.getByText(/Set the delivery terms after the buyer accepts the financing offer and books the delivery/),
    ).toBeVisible();

    await signInAs(page, "customer@gce.local");
    await open(page, `/customer/my-transactions/${id}`);
    await page.getByLabel("Delivery date and time").fill(futureSlot().replace(":00", ":25"));
    await page.getByLabel("Delivery address").fill("SM Calamba parking, Laguna");
    await page.getByRole("button", { name: "Accept and book delivery" }).click();
    await expect(page.getByText("Delivery booked. GCE will confirm the delivery terms.")).toBeVisible();

    await signInAs(page, "sales_manager@gce.local");
    await open(page, `/sales_manager/transactions/${id}`);
    await pickByLabel(page, "Address serviceable", "Yes, we can deliver");
    await page.getByLabel("Delivery fee (₱)").fill("2500");
    await page.getByLabel("Downpayment (₱)").fill("50000");
    await page.getByRole("button", { name: "Confirm and notify buyer" }).click();
    await expect(page.getByText("Set the downpayment to the Initial Downpayment of ₱100,000.")).toBeVisible();
    await page.getByLabel("Downpayment (₱)").fill("100000");
    await page.getByRole("button", { name: "Confirm and notify buyer" }).click();
    await expect(page.getByText("Delivery terms sent to the buyer.")).toBeVisible();

    await signInAs(page, "customer@gce.local");
    await open(page, `/customer/my-transactions/${id}`);
    await expect(
      page.getByText("The balance is paid in monthly installments under your financing agreement."),
    ).toBeVisible();

    await signInAs(page, "head_accountant@gce.local");
    await open(page, `/head_accountant/transactions/${id}`);
    for (const [kind, amount] of [
      ["Delivery fee", "2500"],
      ["Downpayment", "100000"],
    ]) {
      await page.locator("#pay_amount").fill(amount);
      await pick(page, "pay_method", "Bank Transfer");
      await pick(page, "pay_kind", kind);
      await page.getByRole("button", { name: "Record Payment" }).click();
      await expect(page.getByText("Payment recorded.").last()).toBeVisible();
      await page.waitForLoadState("networkidle");
    }
    await verifyAll(page, 2);
    await page.getByRole("button", { name: "Complete financing agreement" }).click();
    await expect(
      page.getByText("Complete the agreement after the car is delivered and the buyer accepts it."),
    ).toBeVisible();

    await signInAs(page, "sales_manager@gce.local");
    await open(page, `/sales_manager/transactions/${id}`);
    await pickByLabel(page, "Confidential Informant");
    await pickByLabel(page, "Mechanic");
    await pickByLabel(page, "Head Security");
    await page.getByRole("button", { name: "Create delivery field case" }).click();
    const link = page.getByRole("link", { name: "Open field case" });
    await expect(link).toBeVisible();
    const casePath = new URL((await link.getAttribute("href")) ?? "", page.url()).pathname.replace(/^\/[^/]+/, "");
    await signInAs(page, "head_security@gce.local");
    await open(page, `/head_security${casePath}`);
    await expect(page.getByText("Collect nothing on delivery: the balance is financed by GCE.")).toBeVisible();
    for (const step of ["Dispatched", "In Transit", "Arriving", "Delivered"]) {
      await page.getByRole("button", { name: `Mark ${step}` }).click();
      await expect(page.getByText(`Marked ${step}.`)).toBeVisible();
      await page.waitForLoadState("networkidle");
    }

    await signInAs(page, "head_accountant@gce.local");
    await open(page, `/head_accountant/transactions/${id}`);
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
