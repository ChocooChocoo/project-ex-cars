import { expect, type Page, test } from "@playwright/test";

const seedPassword = process.env.SEED_USER_PASSWORD;

function getSeedPassword() {
  if (!seedPassword) throw new Error("SEED_USER_PASSWORD is required for Task 28 browser checks.");
  return seedPassword;
}

async function signIn(page: Page, path: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto("/auth/v1/login");
    await page.getByLabel("Email Address", { exact: true }).fill("ceo@gce.local");
    await page.getByLabel("Password", { exact: true }).fill(getSeedPassword());
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page
      .waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 15000 })
      .catch(() => undefined);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    if (new URL(page.url()).pathname === path) return;
  }

  await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
}

test.describe("Task 28 CEO workflow regressions", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD is required for Task 28 browser checks.");

  test("finance verification waits for confirmation", async ({ page }) => {
    await signIn(page, "/ceo/finance");
    const verify = page.getByRole("button", { name: "Verify", exact: true }).first();
    await expect(verify).toBeVisible();
    await verify.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("announcement status changes wait for confirmation", async ({ page }) => {
    await signIn(page, "/ceo/announcements");
    const action = page.getByRole("button", { name: /^(Publish|Expire)$/ }).first();
    await expect(action).toBeVisible();
    await action.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("roadmap creation opens the side drawer in place", async ({ page }) => {
    await signIn(page, "/ceo/roadmap");
    await page.getByRole("button", { name: "New", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Add Roadmap Item");
    await expect(page).toHaveURL(/\/ceo\/roadmap$/);
  });

  test("payroll employee selector opens with employees", async ({ page }) => {
    await signIn(page, "/ceo/payroll");
    await page.getByRole("button", { name: "Add Compensation", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Add Compensation Record", { exact: true })).toBeVisible();
    await dialog.getByRole("combobox").first().click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("field case selectors expose permitted kinds and workers", async ({ page }) => {
    await signIn(page, "/ceo/field-cases");
    await page.getByRole("button", { name: "Create Field Case", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const selectors = dialog.getByRole("combobox");
    await selectors.nth(0).click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await selectors.nth(1).click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("supplier messages uses a responsive master-detail conversation", async ({ page }) => {
    await signIn(page, "/ceo/supplier-messages");
    const shell = page.getByTestId("supplier-chat-shell");
    await expect(shell).toBeVisible();
    const rows = shell.getByTestId("supplier-row");
    await expect(rows.first()).toBeVisible();
    await rows.first().click();
    await expect(shell.getByPlaceholder("Type a message...", { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await rows.first().click();
    await expect(page.getByRole("button", { name: "Back to conversations", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
