import { type Page, test } from "@playwright/test";

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

// Buying-flow revision, Phase 2 (docs/implementation-plan/buying-flow-revision/phase-2.md): the
// Confidential Informant keeps a car's papers. At a GCE visit the Sales Manager requests them, the CI
// hands them over and the Sales Manager receives them; only then is the car marked sold. For a
// delivery the assigned CI records the release before the car is dispatched.

const PAPERS_FIRST = "The Confidential Informant must release the vehicle papers before the car is marked sold.";

const markSold = (page: Page) => page.getByRole("button", { name: /Mark Sold to This Buyer/ });

async function papersStatus(transactionId: string) {
  const { data } = await db()
    .from("sale_handovers")
    .select("papers_status")
    .eq("transaction_id", transactionId)
    .maybeSingle();
  return data?.papers_status ?? null;
}

test.describe
  .serial("Buying revision phase 2", () => {
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

    test("Scenario 1: the car is marked sold only after the papers are requested, handed over and received", async ({
      page,
    }) => {
      test.slow();
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P2-VISIT"), {
        method: "Cash",
        arrangement: "GCE Visit",
        when: futureSlot(),
      });
      await approveAsSalesManager(page, id);
      await expect(page.getByText("With the Confidential Informant")).toBeVisible();

      // Cash is recorded, but the papers cannot be requested until the Head Accountant checks it.
      await page.locator("#pay_amount").fill("500000");
      await pick(page, "pay_method", "Cash");
      await page.getByRole("button", { name: "Record Payment" }).click();
      await expect(page.getByText("Payment recorded.")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Request papers release" }).click();
      await expect(
        page.getByText("The Head Accountant must check the payment before the papers are requested."),
      ).toBeVisible();
      await markSold(page).click();
      await expect(page.getByText(PAPERS_FIRST)).toBeVisible();

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      const verify = page.getByRole("button", { name: "Verify", exact: true });
      await verify.first().click();
      await expect(page.getByText("Payment verified.")).toBeVisible();

      // Papers Requested.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await page.getByRole("button", { name: "Request papers release" }).click();
      await expect(page.getByText("Papers requested from the Confidential Informant.")).toBeVisible();
      await expect(page.getByText("Papers Requested").first()).toBeVisible();
      await page.screenshot({ path: "test-results/phase2-papers-requested-desktop.png", fullPage: true });

      // Papers Handed Over: the CI approves from Field Cases.
      await signInAs(page, "confidential_informant@gce.local");
      await open(page, "/confidential_informant/field-cases");
      const request = page.getByRole("listitem").filter({ hasText: "E2E Test P2-VISIT" });
      await expect(request).toHaveCount(1);
      await page.screenshot({ path: "test-results/phase2-ci-requests-desktop.png" });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "test-results/phase2-ci-requests-mobile.png" });
      await page.setViewportSize({ width: 1280, height: 720 });
      await request.getByRole("button", { name: "Approve and hand over" }).click();
      await expect(page.getByText("Papers handed over to the Sales Manager.")).toBeVisible();
      await expect(request).toHaveCount(0);

      // Still not sold until the Sales Manager has received them.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await expect(page.getByText("Papers Handed Over").first()).toBeVisible();
      await markSold(page).click();
      await expect(page.getByText(PAPERS_FIRST)).toBeVisible();

      // Papers Received, then sold.
      await page.getByRole("button", { name: "Receive papers" }).click();
      await expect(page.getByText("Papers received.")).toBeVisible();
      await expect(page.getByText("Papers Received").first()).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "test-results/phase2-papers-received-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 });
      await markSold(page).click();
      await expect(page.getByText("Transaction moved to completed.")).toBeVisible();

      await signInAs(page, "customer@gce.local");
      await open(page, `/my-transactions/${id}`);
      await expect(page.getByText("Papers Received").first()).toBeVisible();
    });

    test("Scenario 3: the car is dispatched only after the assigned CI records the papers as released", async ({
      page,
    }) => {
      test.slow();
      await signInAs(page, "customer@gce.local");
      const id = await buyerRequest(page, await createTestVehicle("P2-DELIVERY"), {
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

      await signInAs(page, "head_accountant@gce.local");
      await open(page, `/head_accountant/transactions/${id}`);
      const verify = page.getByRole("button", { name: "Verify", exact: true });
      for (const [kind, amount, expected] of [
        ["Delivery fee", "2500", 1],
        ["Downpayment", "50000", 2],
      ] as const) {
        await page.locator("#pay_amount").fill(amount);
        await pick(page, "pay_method", "Bank Transfer");
        await pick(page, "pay_kind", kind);
        await page.getByRole("button", { name: "Record Payment" }).click();
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
      const caseLink = page.getByRole("link", { name: "Open field case" });
      await expect(caseLink).toBeVisible();
      const casePath = new URL((await caseLink.getAttribute("href")) ?? "", page.url()).pathname.replace(
        /^\/[^/]+/,
        "",
      );
      const release = page.getByRole("button", { name: "Record papers released to me" });

      // Head Security cannot record the papers and cannot dispatch without them.
      await signInAs(page, "head_security@gce.local");
      await open(page, `/head_security${casePath}`);
      await expect(page.getByText("Vehicle papers", { exact: true })).toBeVisible();
      await expect(release).toHaveCount(0);
      await page.getByRole("button", { name: "Mark Dispatched" }).click();
      await expect(
        page.getByText("The Confidential Informant must record the vehicle papers as released before dispatch."),
      ).toBeVisible();

      // Neither can the Mechanic.
      await signInAs(page, "mechanic@gce.local");
      await open(page, `/mechanic${casePath}`);
      await expect(page.getByText("Vehicle papers", { exact: true })).toBeVisible();
      await expect(release).toHaveCount(0);

      // The assigned CI records the release.
      await signInAs(page, "confidential_informant@gce.local");
      await open(page, `/confidential_informant${casePath}`);
      await release.click();
      await expect(page.getByText("Papers recorded as released to you.")).toBeVisible();
      await expect(page.getByText("Papers Released to CI")).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "test-results/phase2-field-papers-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 });

      await signInAs(page, "head_security@gce.local");
      await open(page, `/head_security${casePath}`);
      for (const step of ["Dispatched", "In Transit", "Arriving"]) {
        await page.getByRole("button", { name: `Mark ${step}` }).click();
        await expect(page.getByText(`Marked ${step}.`)).toBeVisible();
        await page.waitForLoadState("networkidle");
      }

      // Nobody is home: the papers go back under the CI.
      await signInAs(page, "sales_manager@gce.local");
      await open(page, `/sales_manager/transactions/${id}`);
      await page.getByRole("button", { name: /Buyer unavailable/ }).click();
      await expect(page.getByText("Recorded: buyer didn't show up.")).toBeVisible();
      expect(await papersStatus(id)).toBe("returned");
      await page.reload();
      await expect(page.getByText("Papers Returned to CI")).toBeVisible();
    });
  });
