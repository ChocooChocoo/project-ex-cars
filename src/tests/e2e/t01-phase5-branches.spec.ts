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
  proposeTerms,
  seedPassword,
  signInAs,
  verifyAll,
} from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// T01 In-House Financing (§6) branches the main spec does not walk: terms returned by the Head
// Accountant and the CEO, a buyer who declines the offer, a Potential Buyer who later claims the car
// and pays every installment, and missed installments leading to repossession, reconditioning,
// repricing and relisting. Missed installments are reached by backdating their due dates through the
// service role; every flow step goes through the UI.

const tag = Math.floor(100 + Math.random() * 899);

async function requestFinancing(page: Page, label: string) {
  const vehicleId = await createTestVehicle(label);
  await signInAs(page, "customer@gce.local");
  const id = await buyerRequest(page, vehicleId, { method: "Financing", arrangement: "GCE Visit" });
  await approveAsSalesManager(page, id);
  return { id, vehicleId };
}

async function buyerBooksVisit(page: Page, id: string) {
  await signInAs(page, "customer@gce.local");
  await open(page, `/customer/my-transactions/${id}`);
  await page.getByLabel("GCE visit (on the hour)").fill(futureSlot());
  await page.getByRole("button", { name: "Accept and book visit" }).click();
  await expect(page.getByText(/Visit booked/)).toBeVisible();
}

// Purchase Claim → Initial Downpayment → agreement → sold.
async function claimPayAndSell(page: Page, id: string, downpayment: number) {
  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${id}`);
  await page.getByRole("button", { name: "Record Purchase Claim" }).click();
  await expect(page.getByText("Purchase Claim recorded.")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.locator("#pay_amount").fill(String(downpayment));
  await pick(page, "pay_method", "Bank Transfer");
  await pick(page, "pay_kind", "Downpayment");
  await page.getByRole("button", { name: "Record Payment" }).click();
  await expect(page.getByText("Payment recorded.")).toBeVisible();

  await signInAs(page, "head_accountant@gce.local");
  await open(page, `/head_accountant/transactions/${id}`);
  await verifyAll(page, 1);
  await page.getByRole("button", { name: "Complete financing agreement" }).click();
  await expect(page.getByText("Financing account opened.")).toBeVisible();

  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${id}`);
  await page.getByRole("button", { name: /Mark Sold to This Buyer/ }).click();
  await expect(page.getByText("Transaction moved to completed.")).toBeVisible();
}

async function flow(id: string) {
  const { data } = await db()
    .from("transactions")
    .select("current_state, flow_status, queue_state")
    .eq("id", id)
    .single();
  return data;
}

test.describe
  .serial("T01 financing branches", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    // A click that cannot land fails in a minute instead of holding the run until the test timeout.
    test.use({ actionTimeout: 60_000 });
    test.afterAll(archiveListedTestVehicles);

    test("terms returned by the Head Accountant and the CEO, then declined by the buyer", async ({ page }) => {
      const { id } = await requestFinancing(page, "FIN-RETURNED");
      await proposeTerms(page, 12, 500_000, 100_000);

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await page.getByLabel("Reason, if returning").fill("Downpayment too low for a 12-month term");
      await page.getByRole("button", { name: "Return for revision" }).click();
      await expect(page.getByText("Terms returned to the Sales Manager.")).toBeVisible();

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await expect(page.getByText(/Returned: Downpayment too low/)).toBeVisible();
      await proposeTerms(page, 12, 500_000, 150_000);
      await headAccountantApproves(page, id);

      await signInAs(page, "ceo@gce.local");
      await open(page, `/ceo/transactions/${id}`);
      await page.getByLabel("Reason, if returning").fill("Shorten to 10 months");
      await page.getByRole("button", { name: "Return for revision" }).click();
      await expect(page.getByText("Terms returned to the Sales Manager.")).toBeVisible();

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await proposeTerms(page, 10, 500_000, 150_000);
      await headAccountantApproves(page, id);
      await ceoConfirms(page, id);

      await signInAs(page, "customer@gce.local");
      await open(page, `/customer/my-transactions/${id}`);
      await page.getByRole("button", { name: "Don't proceed" }).click();
      await expect(page.getByText("Request closed.")).toBeVisible();
      expect((await flow(id))?.current_state).toBe("cancelled");
    });

    test("a Potential Buyer claims later and pays every installment", async ({ page }) => {
      const { id, vehicleId } = await requestFinancing(page, "FIN-POTENTIAL");
      await proposeTerms(page, 1, 300_000, 100_000);
      await headAccountantApproves(page, id);
      await ceoConfirms(page, id);
      await buyerBooksVisit(page, id);

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await page.getByRole("button", { name: "Needs time: Potential Buyer" }).click();
      await expect(page.getByText("Recorded as Potential Buyer.")).toBeVisible();
      expect(await flow(id)).toMatchObject({ flow_status: "potential_buyer", queue_state: null });
      const { data: listed } = await db().from("vehicles").select("listing_state").eq("id", vehicleId).single();
      expect(listed?.listing_state).toBe("available");

      await claimPayAndSell(page, id, 100_000);

      // The single installment is paid; the financing completes.
      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await page.getByRole("button", { name: "Record paid" }).click();
      await expect(page.getByText("Installment recorded as paid.")).toBeVisible();
      expect((await flow(id))?.flow_status).toBe("financing_completed");
    });

    test("missed installments lead to repossession, reconditioning, repricing and relisting", async ({ page }) => {
      const { id, vehicleId } = await requestFinancing(page, "FIN-REPO");
      await proposeTerms(page, 6, 600_000, 120_000);
      await headAccountantApproves(page, id);
      await ceoConfirms(page, id);
      await buyerBooksVisit(page, id);
      await claimPayAndSell(page, id, 120_000);

      // Four installments fall due and go unpaid.
      const { data: account } = await db()
        .from("installment_accounts")
        .select("id, installments(id, sequence_no)")
        .eq("purchase_transaction_id", id)
        .single();
      const first4 = (account?.installments ?? []).sort((a, b) => a.sequence_no - b.sequence_no).slice(0, 4);
      for (const [index, installment] of first4.entries()) {
        const due = new Date();
        due.setMonth(due.getMonth() - (5 - index));
        await db()
          .from("installments")
          .update({ due_date: due.toISOString().slice(0, 10) })
          .eq("id", installment.id);
      }

      // The Head Accountant's dashboard runs the missed-payment check.
      await signInAs(page, "head_accountant@gce.local");
      await open(page, "/dashboard");
      await open(page, `/head_accountant/transactions/${id}`);
      await expect(page.getByText("Flagged: missed payment")).toBeVisible();
      await page.getByRole("button", { name: "Instruct Repossession" }).click();
      await page.locator("#repo-informant").click();
      await page.getByRole("option").first().click();
      await page.locator("#repo-head-security").click();
      await page.getByRole("option").first().click();
      await page.getByRole("button", { name: "Instruct", exact: true }).click();
      await expect(page.getByText(/Repossession instructed/)).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Record car recovered by GCE" }).click();
      await expect(page.getByText("Car recorded as recovered; reconditioning opened.")).toBeVisible();
      expect((await flow(id))?.flow_status).toBe("repossessed");

      // Mechanic: status report and fund request.
      const estimate = 40_000 + tag;
      await signInAs(page, "mechanic@gce.local");
      await open(page, `/mechanic/vehicles/${vehicleId}`);
      await page.locator("#recon-report").fill("Scratched panels, worn tyres, interior stains");
      await page.locator("#recon-parts").fill("4 tyres, detailing, panel repaint");
      await page.locator("#recon-estimate").fill(String(estimate));
      await page.getByRole("button", { name: "Submit report and request funds" }).click();
      await expect(page.getByText("Report sent; fund request raised.")).toBeVisible();

      // Head Accountant releases the fund.
      await signInAs(page, "head_accountant@gce.local");
      await open(page, "/head_accountant/finance");
      await page.getByRole("tab", { name: /Disbursements/ }).click();
      const row = page
        .getByRole("row")
        .filter({ hasText: "Reconditioning fund" })
        .filter({ hasText: `₱${estimate.toLocaleString()}` });
      await row.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(row.getByText("approved", { exact: true })).toBeVisible();
      await row.getByRole("button", { name: "Release", exact: true }).click();
      await expect(row.getByText("released", { exact: true })).toBeVisible();

      // Mechanic repairs; Sales Manager re-processes the papers.
      await signInAs(page, "mechanic@gce.local");
      await open(page, `/mechanic/vehicles/${vehicleId}`);
      await page.getByRole("button", { name: "Start repairs" }).click();
      await expect(page.getByText("Repairs started.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.locator("#recon-final").fill("Tyres replaced, panels repainted, interior detailed");
      await page.locator("#recon-actual").fill("38500");
      await page.getByRole("button", { name: "Complete reconditioning" }).click();
      await expect(page.getByText("Reconditioning completed.")).toBeVisible();

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/vehicles/${vehicleId}`);
      await page.getByRole("button", { name: "Mark papers re-processed" }).click();
      await expect(page.getByText("Papers marked re-processed.")).toBeVisible();

      // Marketing Specialist reprices; the CEO approves; the car is listed again.
      const { data: car } = await db().from("vehicles").select("stock_code").eq("id", vehicleId).single();
      await signInAs(page, "marketing_specialist@gce.local");
      await open(page, "/marketing_specialist/vehicles");
      await page.getByPlaceholder("Search vehicles...").fill(car?.stock_code as string);
      await page.getByRole("button", { name: `Open actions for ${car?.stock_code}` }).click();
      await page.getByRole("menuitem", { name: "Propose Price" }).click();
      await page.getByLabel("Proposed price").fill("540000");
      await page.getByRole("button", { name: "Submit Proposal" }).click();
      await expect(page.getByText("Price proposal submitted.")).toBeVisible();
      const { data: proposal } = await db()
        .from("vehicle_price_proposals")
        .select("proposal_kind")
        .eq("vehicle_id", vehicleId)
        .eq("decision", "pending")
        .single();
      expect(proposal?.proposal_kind).toBe("reprice");

      await signInAs(page, "ceo@gce.local");
      await open(page, "/ceo/vehicles");
      await page.getByRole("button", { name: `Open actions for ${vehicleId.slice(0, 8)}` }).click();
      await page.getByRole("menuitem", { name: "Approve" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Approve" }).click();
      await expect(page.getByText("Price proposal approved.")).toBeVisible();

      const { data: relisted } = await db()
        .from("vehicles")
        .select("listing_state, current_price")
        .eq("id", vehicleId)
        .single();
      expect(relisted).toMatchObject({ listing_state: "available", current_price: 540000 });
    });
  });
