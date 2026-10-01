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
  pick,
  pickByLabel,
  proposeTerms,
  resetCustomerStanding,
  seedPassword,
  signInAs,
  verifyAll,
} from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// T01 Phase 6, §10–11 (Phase 6 defaults until the client writes these sections): In-House Financing with
// a Calabarzon meet-up (§10) or a delivery (§11) in place of the §6 GCE visit. The financing steps are
// the §6 ones; the meet-up and delivery steps are the §3 and §4 ones.

const DOWNPAYMENT = 100_000;

async function approvedFinancing(page: Page, label: string, arrangement: "CALABARZON Meet-up" | "Delivery") {
  await signInAs(page, "customer@gce.local");
  const id = await buyerRequest(page, await createTestVehicle(label), { method: "Financing", arrangement });
  await approveAsSalesManager(page, id);
  await proposeTerms(page, 12, 500_000, DOWNPAYMENT);
  await headAccountantApproves(page, id);
  await ceoConfirms(page, id);
  return id;
}

async function buyerAccepts(page: Page, id: string, kind: "meet-up" | "delivery") {
  await signInAs(page, "customer@gce.local");
  await open(page, `/customer/my-transactions/${id}`);
  await page.getByLabel(kind === "meet-up" ? "Meet-up date and time" : "Delivery date and time").fill(futureSlot());
  await page
    .getByLabel(kind === "meet-up" ? "Meet-up location (Calabarzon)" : "Delivery address")
    .fill("SM Calamba parking, Laguna");
  await page.getByRole("button", { name: `Accept and book ${kind}` }).click();
  await expect(page.getByText(kind === "meet-up" ? /Meet-up booked/ : /Delivery booked/)).toBeVisible();
}

async function recordPayment(page: Page, kind: string, amount: number) {
  await page.locator("#pay_amount").fill(String(amount));
  await pick(page, "pay_method", "Bank Transfer");
  await pick(page, "pay_kind", kind);
  await page.getByRole("button", { name: "Record Payment" }).click();
  await expect(page.getByText("Payment recorded.").last()).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function markSold(page: Page, id: string) {
  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${id}`);
  await page.getByRole("button", { name: /Mark Sold to This Buyer/ }).click();
  await expect(page.getByText("Transaction moved to completed.")).toBeVisible();
  const { data } = await db().from("transactions").select("current_state, flow_status").eq("id", id).single();
  expect(data).toEqual({ current_state: "completed", flow_status: "financing_active" });
}

test.describe
  .serial("T01 financing with a meet-up or a delivery", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    // A click that cannot land fails in a minute instead of holding the run until the test timeout.
    test.use({ actionTimeout: 60_000 });
    test.beforeAll(resetCustomerStanding);
    test.afterAll(archiveListedTestVehicles);

    test("§10: the buyer meets halfway, claims the car, pays the downpayment and signs", async ({ page }) => {
      const id = await approvedFinancing(page, "FIN-MEETUP", "CALABARZON Meet-up");
      await buyerAccepts(page, id, "meet-up");
      const { data: meetup } = await db()
        .from("viewing_arrangements")
        .select("arrangement_kind, location")
        .eq("purchase_transaction_id", id)
        .in("confirmation_state", ["pending", "confirmed"])
        .single();
      expect(meetup).toEqual({ arrangement_kind: "meetup", location: "SM Calamba parking, Laguna" });

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await page.getByRole("button", { name: "Record Purchase Claim" }).click();
      await expect(page.getByText("Purchase Claim recorded.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await recordPayment(page, "Downpayment", DOWNPAYMENT);

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await verifyAll(page, 1);
      await page.getByRole("button", { name: "Complete financing agreement" }).click();
      await expect(page.getByText("Financing account opened.")).toBeVisible();
      await markSold(page, id);
    });

    test("§11: the car is delivered on the downpayment and the agreement is signed on acceptance", async ({ page }) => {
      const id = await approvedFinancing(page, "FIN-DELIVERY", "Delivery");
      await buyerAccepts(page, id, "delivery");

      // The delivery downpayment must be the Initial Downpayment.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await pickByLabel(page, "Address serviceable", "Yes, we can deliver");
      await page.getByLabel("Delivery fee (₱)").fill("2500");
      await page.getByLabel("Downpayment (₱)").fill("50000");
      await page.getByRole("button", { name: "Confirm and notify buyer" }).click();
      await expect(page.getByText(/Set the downpayment to the Initial Downpayment/)).toBeVisible();
      await page.getByLabel("Downpayment (₱)").fill(String(DOWNPAYMENT));
      await page.getByRole("button", { name: "Confirm and notify buyer" }).click();
      await expect(page.getByText("Delivery terms sent to the buyer.")).toBeVisible();

      await signInAs(page, "customer@gce.local");
      await open(page, `/customer/my-transactions/${id}`);
      await expect(
        page.getByText("The balance is paid in monthly installments under your financing agreement."),
      ).toBeVisible();

      // Fee and Initial Downpayment are paid and verified; the agreement waits for the hand-over.
      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await recordPayment(page, "Delivery fee", 2500);
      await recordPayment(page, "Downpayment", DOWNPAYMENT);
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
      const caseLink = page.getByRole("link", { name: "Open field case" });
      await expect(caseLink).toBeVisible();
      const casePath = new URL((await caseLink.getAttribute("href")) ?? "", page.url()).pathname.replace(
        /^\/[^/]+/,
        "",
      );

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
      await markSold(page, id);
    });
  });
