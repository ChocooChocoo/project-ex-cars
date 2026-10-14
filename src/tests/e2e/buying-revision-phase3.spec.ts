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
} from "./support/t01";
import { archiveListedTestVehicles, canCreateTestVehicle, createTestVehicle } from "./support/test-vehicle";

// Buying-flow revision, Phase 3 (docs/implementation-plan/buying-flow-revision/phase-3.md): a contract
// is written, approved, signed and recorded as kept before money is recorded, the papers are handed
// over, or the car is marked sold.

const SIGN_BEFORE_PAYMENT = "The buyer must sign the contract before a payment is recorded.";

const markSold = (page: Page) => page.getByRole("button", { name: /Mark Sold to This Buyer/ });

async function recordPayment(page: Page, amount: string, method: string, kind: string) {
  await page.locator("#pay_amount").fill(amount);
  await pick(page, "pay_method", method);
  await pick(page, "pay_kind", kind);
  await page.getByRole("button", { name: "Record Payment" }).click();
}

async function userId(email: string): Promise<string> {
  const { data } = await db().auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((u) => u.email === email)?.id ?? "";
}

test.describe
  .serial("Buying revision phase 3", () => {
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

    test("Scenario 4: the buyer signs only an approved contract, and no payment is recorded before that", async ({
      page,
    }) => {
      test.slow();
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P3-FINANCE"), {
        method: "Financing",
        arrangement: "GCE Visit",
      });
      await approveAsSalesManager(page, id);
      await proposeTerms(page, 12, 500000, 100000);
      await headAccountantApproves(page, id);
      await ceoConfirms(page, id);

      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await page.getByLabel("GCE visit date and time").fill(futureSlot());
      await page.getByRole("button", { name: "Accept and book visit" }).click();
      await expect(page.getByText(/Visit booked/)).toBeVisible();
      const sign = page.getByRole("button", { name: "Sign contract" });
      await expect(page.getByText("GCE is preparing your contract.")).toBeVisible();
      await expect(sign).toHaveCount(0);

      // No payment before the signature.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await recordPayment(page, "100000", "Bank Transfer", "Downpayment");
      await expect(page.getByText(SIGN_BEFORE_PAYMENT)).toBeVisible();

      // The Sales Manager writes the contract from the pre-made one and sends it.
      await page.getByRole("button", { name: "Start from the pre-made contract" }).click();
      await expect(page.getByLabel("Contract text")).toHaveValue(/PHP 500,000/);
      await page.screenshot({ path: "test-results/phase3-contract-editor-desktop.png", fullPage: true });
      await page.getByRole("button", { name: "Send for approval" }).click();
      await expect(page.getByText("Contract sent to the Head Accountant.")).toBeVisible();
      await expect(page.getByText("Waiting for Head Accountant")).toBeVisible();

      // Not approved yet: nothing for the buyer to sign.
      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText("GCE is preparing your contract.")).toBeVisible();
      await expect(sign).toHaveCount(0);

      // The Head Accountant returns it with a reason, then approves the revision.
      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      const returnIt = page.getByRole("button", { name: "Return for revision" });
      await expect(returnIt).toBeDisabled();
      await page.getByLabel("What to revise").fill("State the 12-month length.");
      await returnIt.click();
      await expect(page.getByText("Contract returned to the Sales Manager.")).toBeVisible();

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await expect(page.getByText("Returned by the Head Accountant: State the 12-month length.")).toBeVisible();
      await page.getByRole("button", { name: "Send for approval" }).click();
      await expect(page.getByText("Contract sent to the Head Accountant.")).toBeVisible();

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      await page.getByRole("button", { name: "Approve contract" }).click();
      await expect(page.getByText("Contract approved. The buyer can sign it.")).toBeVisible();

      // The buyer reads and signs.
      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText(/PHP 500,000/)).toBeVisible();
      await expect(sign).toBeDisabled();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "test-results/phase3-buyer-sign-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.getByLabel("Type your full name to sign").fill("Maria Santos");
      await sign.click();
      await expect(page.getByText("Contract signed.")).toBeVisible();
      await expect(page.getByText(/You signed this contract/)).toBeVisible();

      // Now the payment is taken.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await expect(page.getByText("Contract Signed").first()).toBeVisible();
      await recordPayment(page, "100000", "Bank Transfer", "Downpayment");
      await expect(page.getByText("Payment recorded.")).toBeVisible();
    });

    test("Scenario 2: with one signed copy recorded the contract is not fully kept and the car is not sold", async ({
      page,
    }) => {
      test.slow();
      const when = futureSlot();
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P3-MEETUP"), {
        method: "Cash",
        arrangement: "CALABARZON Meet-up",
        when,
      });
      await approveAsSalesManager(page, id);

      // Set-up only: Phase 4 makes the Sales Manager assign the meet-up team at approval. Until then
      // the case is created here with the same columns createFieldCase writes.
      const { data: fieldCase } = await db()
        .from("field_cases")
        .insert({
          transaction_id: id,
          case_kind: "buyer_meetup",
          assigned_confidential_informant: await userId("confidential_informant@gce.local"),
          mechanic_id: await userId("mechanic@gce.local"),
          schedule: new Date(when).toISOString(),
          location: "SM Calamba parking, Laguna",
          state: "assigned",
        })
        .select("id")
        .single();
      const casePath = `/field-cases/${fieldCase?.id}`;
      const keepCopy = page.getByRole("button", { name: "Record my signed copy" });

      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await page.getByRole("button", { name: "Record papers released to me" }).click();
      await expect(page.getByText("Papers recorded as released to you.")).toBeVisible();
      await expect(keepCopy).toHaveCount(0);
      await page.getByRole("button", { name: "Record Buyer Met" }).click();
      await expect(page.getByText("Buyer Met recorded.")).toBeVisible();
      await page.getByRole("button", { name: "Report contract signed" }).click();
      await expect(page.getByText("Signing reported to GCE.")).toBeVisible();
      await keepCopy.click();
      await expect(page.getByText("Your signed copy is recorded.")).toBeVisible();
      await expect(
        page.getByText("The signed contract is not fully kept. Still to record a copy: Mechanic."),
      ).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "test-results/phase3-field-contract-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.getByRole("button", { name: "Report payment received" }).click();
      await expect(page.getByText("Payment reported to the Sales Manager.")).toBeVisible();
      await page.getByRole("button", { name: "Hand papers to buyer" }).click();
      await expect(page.getByText("Papers handed to the buyer.")).toBeVisible();

      // The Sales Manager is told who is missing, and Mark as Sold is refused.
      const { data: notice } = await db()
        .from("notifications")
        .select("body")
        .eq("reference_id", id)
        .eq("kind", "contract_copy_missing")
        .maybeSingle();
      expect(notice?.body).toContain("Still missing: Mechanic.");

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await expect(
        page.getByText("The signed contract is not fully kept. Still to record a copy: Mechanic."),
      ).toBeVisible();
      await page.screenshot({ path: "test-results/phase3-contract-not-kept-desktop.png", fullPage: true });
      await recordPayment(page, "500000", "Cash", "Full payment");
      await expect(page.getByText("Payment recorded.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await markSold(page).click();
      await expect(page.getByText("The Mechanic has not recorded keeping the signed contract.")).toBeVisible();

      await signInAs(page, "mechanic@gce.local");
      await open(page, `/mechanic${casePath}`);
      await keepCopy.click();
      await expect(page.getByText("Your signed copy is recorded.")).toBeVisible();

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await markSold(page).click();
      await expect(page.getByText("Transaction moved to completed.")).toBeVisible();
    });

    test("Scenario 3: the CI hands the papers over only after the signing and the cash are reported", async ({
      page,
    }) => {
      test.slow();
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P3-DELIVERY"), {
        method: "Cash",
        arrangement: "Delivery",
        when: futureSlot(),
      });
      await approveAsSalesManager(page, id);
      await pickByLabel(page, "Address serviceable", "Yes, we can deliver");
      await page.getByLabel("Delivery fee (₱)").fill("2500");
      await page.getByLabel("Downpayment (₱)").fill("50000");
      await page.getByRole("button", { name: "Confirm and notify buyer" }).click();
      await expect(page.getByText("Delivery terms sent to the buyer.")).toBeVisible();

      // The fee and the downpayment come before delivery day, so before the contract is signed.
      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      const verify = page.getByRole("button", { name: "Verify", exact: true });
      for (const [kind, amount, expected] of [
        ["Delivery fee", "2500", 1],
        ["Downpayment", "50000", 2],
      ] as const) {
        await recordPayment(page, amount, "Bank Transfer", kind);
        await expect(verify).toHaveCount(expected);
      }
      for (let left = 2; left > 0; left--) {
        await verify.first().click();
        await expect(verify).toHaveCount(left - 1);
      }
      // The balance is not.
      await recordPayment(page, "450000", "Cash", "Balance on delivery");
      await expect(page.getByText(SIGN_BEFORE_PAYMENT)).toBeVisible();

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

      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await page.getByRole("button", { name: "Record papers released to me" }).click();
      await expect(page.getByText("Papers recorded as released to you.")).toBeVisible();

      await signInAs(page, "head_security@gce.local");
      await open(page, `/head_security${casePath}`);
      await expect(page.getByRole("button", { name: "Record Buyer Met" })).toHaveCount(0);
      for (const step of ["Dispatched", "In Transit", "Arriving", "Delivered"]) {
        await page.getByRole("button", { name: `Mark ${step}` }).click();
        await expect(page.getByText(`Marked ${step}.`)).toBeVisible();
        await page.waitForLoadState("networkidle");
      }

      // Papers before the signature: refused.
      const handOver = page.getByRole("button", { name: "Hand papers to buyer" });
      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await handOver.click();
      await expect(page.getByText("The buyer must sign the contract before the papers are handed over.")).toBeVisible();

      // Signed, but the cash is not reported: still refused.
      await page.getByRole("button", { name: "Record Buyer Met" }).click();
      await expect(page.getByText("Buyer Met recorded.")).toBeVisible();
      await page.getByRole("button", { name: "Report contract signed" }).click();
      await expect(page.getByText("Signing reported to GCE.")).toBeVisible();
      await handOver.click();
      await expect(page.getByText("Report the cash received before the papers are handed over.")).toBeVisible();

      await page.getByRole("button", { name: "Report payment received" }).click();
      await expect(page.getByText("Payment reported to the Sales Manager.")).toBeVisible();
      await handOver.click();
      await expect(page.getByText("Papers handed to the buyer.")).toBeVisible();
      await page.screenshot({ path: "test-results/phase3-delivery-contract-desktop.png", fullPage: true });

      // Mark as Sold waits for the CI's signed copy.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await recordPayment(page, "450000", "Cash", "Balance on delivery");
      await expect(page.getByText("Payment recorded.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await markSold(page).click();
      await expect(
        page.getByText("The Confidential Informant has not recorded keeping the signed contract."),
      ).toBeVisible();

      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await page.getByRole("button", { name: "Record my signed copy" }).click();
      await expect(page.getByText("Your signed copy is recorded.")).toBeVisible();

      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await markSold(page).click();
      await expect(page.getByText("Transaction moved to completed.")).toBeVisible();
    });
  });
