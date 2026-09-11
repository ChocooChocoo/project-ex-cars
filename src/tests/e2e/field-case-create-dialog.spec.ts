import { expect, type Page, test } from "@playwright/test";

const seedPassword = process.env.SEED_USER_PASSWORD;

async function signInAs(page: Page, email: string) {
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(seedPassword ?? "");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page
    .waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 15_000 })
    .catch(() => undefined);
}

// Every role that can create a field case, not just the CEO. The Assigned Worker
// dropdown was empty for all of these except the CEO and Account Manager.
const CREATOR_ROLES = [
  { role: "ceo", email: "ceo@gce.local" },
  { role: "confidential_informant", email: "confidential_informant@gce.local" },
  { role: "sales_manager", email: "sales_manager@gce.local" },
  { role: "head_accountant", email: "head_accountant@gce.local" },
];

test.describe("Create Field Case dialog", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD required");

  for (const { role, email } of CREATOR_ROLES) {
    test(`${role} gets a populated, selectable Assigned Worker list`, async ({ page }) => {
      await signInAs(page, email);
      await page.goto(`/${role}/field-cases`);
      await page.getByRole("button", { name: "Create Field Case", exact: true }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // exact: "Select worker" would also match the "Select worker type" trigger.
      const worker = dialog.getByRole("combobox", { name: "Select worker", exact: true });
      await expect(worker).toBeEnabled();
      await worker.click();

      const options = page.getByRole("option");
      await expect(options.first()).toBeVisible();
      expect(await options.count()).toBeGreaterThan(0);

      await options.first().click();
      await expect(dialog).toBeVisible();
    });
  }

  test("clicking the dialog header while a dropdown is open does not dismiss it", async ({ page }) => {
    await signInAs(page, "confidential_informant@gce.local");
    await page.goto("/confidential_informant/field-cases");
    await page.getByRole("button", { name: "Create Field Case", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Select transaction", exact: true }).click();
    await expect(page.getByRole("option").first()).toBeVisible();

    // An open Radix Select sets pointer-events: none on the dialog content, so a click
    // aimed at the heading is delivered to the overlay. It must dismiss the select
    // without dismissing the dialog.
    const heading = page.locator('[role="dialog"] h2');
    const box = await heading.boundingBox();
    if (!box) throw new Error("dialog heading is not visible");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-slot="select-content"][data-state="open"]')).toHaveCount(0);
  });

  test("a click genuinely outside the dialog still dismisses it", async ({ page }) => {
    await signInAs(page, "confidential_informant@gce.local");
    await page.goto("/confidential_informant/field-cases");
    await page.getByRole("button", { name: "Create Field Case", exact: true }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await page.mouse.click(20, 20);

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
