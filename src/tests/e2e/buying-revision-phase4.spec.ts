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
  resetCustomerStanding,
  seedPassword,
  signInAs,
  verifyAll,
} from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// Buying-flow revision, Phase 4 (docs/implementation-plan/buying-flow-revision/phase-4.md): each
// scenario follows the client doc's step order. Scenario 2 names the meet-up team with the approval,
// Scenario 8 takes no downpayment and opens the account on the CI's signing report, Scenario 9 sets the
// delivery fee and downpayment with the financing terms, and financing is agreed in a chat thread.

const POLICY = "From the 4th missed month GCE takes back the vehicle.";
const markSold = (page: Page) => page.getByRole("button", { name: /Mark Sold to This Buyer/ });
const complete = (page: Page) => page.getByRole("button", { name: "Complete financing agreement" });

async function recordPayment(page: Page, amount: string, method: string, kind: string) {
  await page.locator("#pay_amount").fill(amount);
  await pick(page, "pay_method", method);
  await pick(page, "pay_kind", kind);
  await page.getByRole("button", { name: "Record Payment" }).click();
}

// The field case a request's "Open field case" link points at, without the role prefix.
async function fieldCasePath(page: Page) {
  const link = page.getByRole("link", { name: "Open field case" });
  await expect(link).toBeVisible();
  return new URL((await link.getAttribute("href")) ?? "", page.url()).pathname.replace(/^\/[^/]+/, "");
}

async function writeAndApproveContract(page: Page, id: string) {
  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${id}`);
  await page.getByRole("button", { name: "Start from the pre-made contract" }).click();
  await page.getByRole("button", { name: "Send for approval" }).click();
  await expect(page.getByText("Contract sent to the Head Accountant.")).toBeVisible();
  await signInAs(page, "head_accountant@gce.local");
  await open(page, `/head_accountant/transactions/${id}`);
  await page.getByRole("button", { name: "Approve contract" }).click();
  await expect(page.getByText("Contract approved. The buyer can sign it.")).toBeVisible();
}

test.describe
  .serial("Buying revision phase 4", () => {
    test.skip(
      !seedPassword || !canCreateTestVehicle(),
      "SEED_USER_PASSWORD and the Supabase service role are required",
    );
    test.use({ actionTimeout: 60_000 });
    test.beforeAll(resetCustomerStanding);
    test.afterAll(async () => {
      await resetCustomerStanding();
      await archiveListedTestVehicles();
    });

    test("Scenario 2: a cash Meet Halfway is approved only with a Confidential Informant and a Mechanic", async ({
      page,
    }) => {
      test.slow();
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P4-MEETUP"), {
        method: "Cash",
        arrangement: "CALABARZON Meet-up",
        when: futureSlot(),
      });

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await verifyAll(page, 3);
      const approve = page.getByRole("button", { name: /^Transition Approve/ });
      await approve.click();
      await expect(page.getByText("Choose a Confidential Informant and a Mechanic before approving.")).toBeVisible();
      await pickByLabel(page, "Confidential Informant");
      await approve.click();
      await expect(
        page.getByText("Choose a Confidential Informant and a Mechanic before approving.").first(),
      ).toBeVisible();
      await page.screenshot({ path: "test-results/phase4-meetup-team-desktop.png", fullPage: true });

      await pickByLabel(page, "Mechanic");
      await approve.click();
      await expect(page.getByText("Transaction moved to approved.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const casePath = await fieldCasePath(page);

      for (const role of ["confidential_informant", "mechanic"]) {
        await signInAs(page, `${role}@gce.local`);
        await open(page, `/${role}${casePath}`);
        await page.getByRole("button", { name: "Receive Field Case" }).click();
        await expect(page.getByText("Field case received.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Receive Field Case" })).toHaveCount(0);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "test-results/phase4-meetup-case-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 });

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await expect(page.getByText(/Field case received/)).toHaveCount(2);
    });

    test("Scenario 8: a financed meet-up takes no downpayment and opens the account on the signing report", async ({
      page,
    }) => {
      test.setTimeout(900_000);
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P4-FIN-MEETUP"), {
        method: "Financing",
        arrangement: "CALABARZON Meet-up",
        term: "3 years",
      });
      await approveAsSalesManager(page, id);

      // No Initial Downpayment field, and nothing is sent without the missed payment policy.
      await expect(page.getByLabel("Initial Downpayment (₱)")).toHaveCount(0);
      const send = page.getByRole("button", { name: "Send to Head Accountant" });
      await page.getByLabel("Payment duration (months)").fill("36");
      await page.getByLabel("Vehicle price (₱)").fill("500000");
      await page.getByLabel("Monthly payment (₱)").fill("13889");
      await page.getByLabel("First installment due").fill("2033-12-01");
      await expect(send).toBeDisabled();
      await page.getByLabel("Missed payment policy").fill(POLICY);
      await page.screenshot({ path: "test-results/phase4-terms-meetup-desktop.png", fullPage: true });
      await send.click();
      await expect(page.getByText("Terms sent to the Head Accountant.")).toBeVisible();

      // The Sales Manager and the buyer chat on the request.
      await page.getByRole("link", { name: "Open chat with the buyer" }).click();
      const message = page.getByPlaceholder("Type a message...", { exact: true });
      await expect(message).toBeVisible();
      await message.fill("We offer 1, 2, 3 or 5 years. Is 3 years right for you?");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      // The view adds new messages over realtime; a reload proves the message is stored and readable.
      await expect(message).toHaveValue("");
      await page.reload();
      await expect(page.getByText("Is 3 years right for you?")).toBeVisible();

      await headAccountantApproves(page, id);
      await ceoConfirms(page, id);

      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await page.getByRole("link", { name: "Chat with GCE" }).click();
      await expect(page.getByText("Is 3 years right for you?")).toBeVisible();
      const reply = page.getByPlaceholder("Type a message...", { exact: true });
      await reply.fill("Yes, 3 years.");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect(reply).toHaveValue("");
      await page.reload();
      await expect(page.getByText("Yes, 3 years.")).toBeVisible();

      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText(/No downpayment\./)).toBeVisible();
      await page.getByLabel("Meet-up date and time").fill(futureSlot());
      await page.getByLabel("Meet-up location (Calabarzon)").fill("SM Calamba parking, Laguna");
      await page.getByRole("button", { name: "Accept and book meet-up" }).click();
      await expect(page.getByText(/Meet-up booked/)).toBeVisible();

      // The team is assigned only after the contract is approved.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      const assign = page.getByRole("button", { name: "Assign team and send the command" });
      await pickByLabel(page, "Confidential Informant");
      await pickByLabel(page, "Mechanic");
      await expect(page.getByText("Available once the Head Accountant approves the contract.")).toBeVisible();
      await expect(assign).toBeDisabled();

      await writeAndApproveContract(page, id);
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await pickByLabel(page, "Confidential Informant");
      await pickByLabel(page, "Mechanic");
      await assign.click();
      await expect(page.getByText("Confidential Informant notified.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const casePath = await fieldCasePath(page);

      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await page.getByRole("button", { name: "Receive Field Case" }).click();
      await expect(page.getByText("Field case received.")).toBeVisible();
      await page.getByRole("button", { name: "Record papers released to me" }).click();
      await expect(page.getByText("Papers recorded as released to you.")).toBeVisible();
      await page.getByRole("button", { name: "Record Buyer Met" }).click();
      await expect(page.getByText("Buyer Met recorded.")).toBeVisible();

      // Not offered before the CI reports the signing.
      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await expect(page.getByText("In-House Financing", { exact: true })).toBeVisible();
      await expect(complete(page)).toHaveCount(0);

      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await page.getByLabel("Type your full name to sign").fill("Maria Santos");
      await page.getByRole("button", { name: "Sign contract" }).click();
      await expect(page.getByText("Contract signed.")).toBeVisible();

      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await page.getByRole("button", { name: "Report contract signed" }).click();
      await expect(page.getByText("Signing reported to GCE.")).toBeVisible();
      await page.getByRole("button", { name: "Record my signed copy" }).click();
      await expect(page.getByText("Your signed copy is recorded.")).toBeVisible();
      await page.getByRole("button", { name: "Hand papers to buyer" }).click();
      await expect(page.getByText("Papers handed to the buyer.")).toBeVisible();

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await complete(page).click();
      await expect(page.getByText("Financing account opened.")).toBeVisible();

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await markSold(page).click();
      await expect(page.getByText("Transaction moved to completed.")).toBeVisible();

      // Nothing was paid up front: the whole price is financed.
      const { data: account } = await db()
        .from("installment_accounts")
        .select("financed_total, down_payment, opening_balance")
        .eq("purchase_transaction_id", id)
        .single();
      expect(account).toMatchObject({ financed_total: 500000, down_payment: 0, opening_balance: 500000 });
      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText("Amount Financed", { exact: true })).toBeVisible();
      await page.screenshot({ path: "test-results/phase4-financed-meetup-buyer-desktop.png", fullPage: true });
    });

    test("Scenario 9: a financed delivery sets its fee and downpayment with the terms", async ({ page }) => {
      test.setTimeout(900_000);
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P4-FIN-DELIVERY"), {
        method: "Financing",
        arrangement: "Delivery",
        when: futureSlot(),
      });
      await approveAsSalesManager(page, id);

      // Not sent without the delivery fee.
      const send = page.getByRole("button", { name: "Send to Head Accountant" });
      await page.getByLabel("Payment duration (months)").fill("12");
      await page.getByLabel("Vehicle price (₱)").fill("500000");
      await page.getByLabel("Downpayment (₱)").fill("100000");
      await page.getByLabel("Monthly payment (₱)").fill("33334");
      await page.getByLabel("First installment due").fill("2033-12-01");
      await page.getByLabel("Missed payment policy").fill(POLICY);
      await expect(send).toBeDisabled();
      await page.getByLabel("Delivery fee (₱)").fill("2500");
      await send.click();
      await expect(page.getByText("Terms sent to the Head Accountant.")).toBeVisible();

      await headAccountantApproves(page, id);
      await ceoConfirms(page, id);

      // The CEO's confirmation sends the breakdown and sets the payment deadline.
      const { data: offer } = await db()
        .from("notifications")
        .select("body")
        .eq("reference_id", id)
        .eq("kind", "financing_offer")
        .single();
      for (const part of ["₱2,500", "₱100,000", "₱102,500", "₱400,000", "₱33,334"]) {
        expect(offer?.body).toContain(part);
      }
      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText(/Delivery fee ₱2,500(\.00)? and downpayment ₱100,000/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Accept and book/ })).toHaveCount(0);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "test-results/phase4-financed-delivery-buyer-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 });

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      const verify = page.getByRole("button", { name: "Verify", exact: true });
      for (const [kind, amount, expected] of [
        ["Delivery fee", "2500", 1],
        ["Downpayment", "100000", 2],
      ] as const) {
        await recordPayment(page, amount, "Bank Transfer", kind);
        await expect(verify).toHaveCount(expected);
      }
      for (let left = 2; left > 0; left--) {
        await verify.first().click();
        await expect(verify).toHaveCount(left - 1);
      }

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await pickByLabel(page, "Confidential Informant");
      await pickByLabel(page, "Mechanic");
      await pickByLabel(page, "Head Security");
      await page.getByRole("button", { name: "Create delivery field case" }).click();
      const casePath = await fieldCasePath(page);

      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await page.getByRole("button", { name: "Record papers released to me" }).click();
      await expect(page.getByText("Papers recorded as released to you.")).toBeVisible();

      await signInAs(page, "head_security@gce.local");
      await open(page, `/head_security${casePath}`);
      for (const step of ["Dispatched", "In Transit", "Arriving", "Delivered"]) {
        await page.getByRole("button", { name: `Mark ${step}` }).click();
        await expect(page.getByText(`Marked ${step}.`)).toBeVisible();
        await page.waitForLoadState("networkidle");
      }

      // Delivered and the downpayment confirmed, but the signing is not reported yet.
      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await expect(page.getByText("In-House Financing", { exact: true })).toBeVisible();
      await expect(complete(page)).toHaveCount(0);

      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await page.getByRole("button", { name: "Record Buyer Met" }).click();
      await expect(page.getByText("Buyer Met recorded.")).toBeVisible();
      await page.getByRole("button", { name: "Report contract signed" }).click();
      await expect(page.getByText("Signing reported to GCE.")).toBeVisible();
      await page.getByRole("button", { name: "Record my signed copy" }).click();
      await expect(page.getByText("Your signed copy is recorded.")).toBeVisible();
      await page.getByRole("button", { name: "Hand papers to buyer" }).click();
      await expect(page.getByText("Papers handed to the buyer.")).toBeVisible();

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await complete(page).click();
      await expect(page.getByText("Financing account opened.")).toBeVisible();

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await markSold(page).click();
      await expect(page.getByText("Transaction moved to completed.")).toBeVisible();
    });
  });
