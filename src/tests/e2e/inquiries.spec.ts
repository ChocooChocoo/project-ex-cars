import { expect, type Page, test } from "@playwright/test";

const seedPassword = process.env.SEED_USER_PASSWORD;

const ROUTES = [
  { role: "CEO", email: "ceo@gce.local", path: "/ceo/inquiries", title: "Inquiries Queue" },
  { role: "customer", email: "customer@gce.local", path: "/customer/my-inquiries", title: "My Inquiries" },
] as const;

function getSeedPassword() {
  if (!seedPassword) {
    throw new Error("SEED_USER_PASSWORD is required for the inquiry conversation browser regression.");
  }
  return seedPassword;
}

async function signIn(page: Page, email: string, path: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto("/auth/v1/login");
    await page.getByLabel("Email Address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(getSeedPassword());
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page
      .waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 15000 })
      .catch(() => undefined);
    await page.goto(path);
    if (new URL(page.url()).pathname === path) return;
  }

  await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
}

function inquiryRows(page: Page) {
  return page.getByTestId("inquiry-list").getByTestId("inquiry-row");
}

async function assertSharedConversation(page: Page, title: string) {
  const shell = page.getByTestId("inquiry-chat-shell");
  await expect(shell).toBeVisible();
  await expect(shell.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.locator('[data-content-padding="false"]')).toBeVisible();
  await expect(page.getByText("Inquiry not found.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Select a conversation to view messages.", { exact: true })).toHaveCount(0);
  await expect(shell.getByPlaceholder("Type a message...", { exact: true })).toBeVisible({ timeout: 15000 });
}

test.describe("shared inquiry conversation", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD is required for the inquiry conversation browser regression.");

  for (const route of ROUTES) {
    test(`${route.role} automatically opens and switches conversations`, async ({ page }) => {
      test.setTimeout(60000);
      await signIn(page, route.email, route.path);
      await assertSharedConversation(page, route.title);

      const rows = inquiryRows(page);
      await expect(rows.first()).toBeVisible();
      expect(await rows.count()).toBeGreaterThan(1);

      const secondRow = rows.nth(1);
      const secondVehicle = (await secondRow.innerText()).split(/\r?\n/)[0]?.trim();
      await secondRow.click();
      await expect(secondRow).toHaveClass(/bg-muted/);
      if (secondVehicle) {
        await expect(page.getByText(secondVehicle, { exact: true }).last()).toBeVisible();
      }
    });
  }

  for (const route of ROUTES) {
    test(`${route.role} direct inquiry route uses the shared conversation`, async ({ page }) => {
      test.setTimeout(60000);
      await signIn(page, route.email, route.path);
      await assertSharedConversation(page, route.title);

      const inquiryId = await inquiryRows(page).first().getAttribute("data-inquiry-id");
      expect(inquiryId).toMatch(/^[0-9a-f-]{36}$/i);
      await page.goto(`${route.path}/${inquiryId}`);
      await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll("/", "\\/")}/[0-9a-f-]{36}$`, "i"));
      await expect(page.getByText("Inquiry not found.", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Select a conversation to view messages.", { exact: true })).toHaveCount(0);
      await expect(page.getByPlaceholder("Type a message...", { exact: true })).toBeVisible({ timeout: 15000 });
    });
  }

  test("CEO controls remain available in the shared thread", async ({ page }) => {
    test.setTimeout(60000);
    await signIn(page, "ceo@gce.local", "/ceo/inquiries");
    await assertSharedConversation(page, "Inquiries Queue");

    const rows = inquiryRows(page);
    const actionCount = async () =>
      (await page.getByRole("button", { name: /Assign to Me|Request Handoff|Accept Handoff|Schedule/ }).count()) +
      (await page.getByText("Handed off to Sales Manager", { exact: true }).count());

    for (let index = 0; index < Math.min(await rows.count(), 20); index++) {
      await rows.nth(index).click();
      if ((await actionCount()) > 0) return;
    }

    expect(await actionCount()).toBeGreaterThan(0);
  });

  for (const route of ROUTES) {
    test(`${route.role} mobile list and thread transition has no horizontal overflow`, async ({ page }) => {
      test.setTimeout(60000);
      await signIn(page, route.email, route.path);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await assertSharedConversation(page, route.title);

      const rows = inquiryRows(page);
      await expect(rows.first()).toBeVisible();
      await rows.first().click();
      await expect(page.getByRole("button", { name: "Back to conversations", exact: true })).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);

      await page.getByRole("button", { name: "Back to conversations", exact: true }).click();
      await expect(rows.first()).toBeVisible();
    });
  }
});
