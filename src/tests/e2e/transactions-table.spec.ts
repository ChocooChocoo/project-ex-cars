import { expect, type Page, test } from "@playwright/test";

const seedPassword = process.env.SEED_USER_PASSWORD;

type FilterMode = "menu" | "combobox";

const ROUTES = [
  {
    role: "CEO",
    email: "ceo@gce.local",
    path: "/ceo/transactions",
    rowsPerPageId: "recent-transactions-rows-per-page",
    kindLabel: "Billing",
    filterMode: "menu" as FilterMode,
  },
  {
    role: "customer",
    email: "customer@gce.local",
    path: "/customer/my-transactions",
    rowsPerPageId: "transactions-rows-per-page",
    kindLabel: "Kind",
    filterMode: "combobox" as FilterMode,
  },
] as const;

function getSeedPassword() {
  if (!seedPassword) {
    throw new Error("SEED_USER_PASSWORD is required for the transaction table browser regression.");
  }
  return seedPassword;
}

async function signIn(page: Page, email: string, path: string) {
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(getSeedPassword());
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 30_000 });
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
}

function filterTrigger(page: Page, label: string, mode: FilterMode) {
  if (mode === "combobox")
    return page
      .getByRole("combobox")
      .filter({ hasText: `${label}:` })
      .first();
  return page.getByRole("button", { name: label, exact: true }).first();
}

async function chooseFilter(page: Page, label: string, option: string, mode: FilterMode) {
  await filterTrigger(page, label, mode).click();
  if (mode === "combobox") await page.getByRole("option", { name: option, exact: true }).click();
  else await page.getByRole("menuitemradio", { name: option, exact: true }).click();
}

function pageIndicator(page: Page) {
  return page.getByText(/^Page \d+ of \d+$/).first();
}

function tableRows(page: Page) {
  return page.locator("tbody tr");
}

test.describe("transaction table filtering and pagination", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD is required for the transaction table browser regression.");

  for (const route of ROUTES) {
    test(`${route.role} table updates rows when filtered and paginated`, async ({ page }) => {
      await signIn(page, route.email, route.path);

      await expect(tableRows(page).first()).toBeVisible();
      await expect(pageIndicator(page)).toHaveText(/^Page 1 of \d+$/);

      const firstPageRows = await tableRows(page).allTextContents();
      const indicator = await pageIndicator(page).textContent();
      const totalPages = Number(indicator?.match(/of (\d+)/)?.[1] ?? "1");
      if (totalPages > 1) {
        await page.getByRole("button", { name: "Go to next page" }).click();
        await expect(pageIndicator(page)).toHaveText(/^Page 2 of \d+$/);
        await expect(tableRows(page).first()).toBeVisible();
        expect(await tableRows(page).allTextContents()).not.toEqual(firstPageRows);
        await page.getByRole("button", { name: "Go to previous page" }).click();
      }

      await chooseFilter(page, route.kindLabel, "Buy", route.filterMode);
      await expect(pageIndicator(page)).toHaveText(/^Page 1 of \d+$/);
      const buyRows = await tableRows(page).allTextContents();
      expect(buyRows.length).toBeGreaterThan(0);
      expect(buyRows.every((row) => row.includes("Buy"))).toBe(true);

      await chooseFilter(page, "Status", "Pending", route.filterMode);
      await expect(pageIndicator(page)).toHaveText(/^Page 1 of \d+$/);
      const pendingRows = await tableRows(page).allTextContents();
      expect(pendingRows.length).toBeGreaterThan(0);
      expect(pendingRows.every((row) => row.includes("Pending"))).toBe(true);

      const search = page.getByPlaceholder("Search transactions...", { exact: true });
      await search.fill("__no_matching_transaction__");
      await expect(page.getByText("No results.", { exact: true })).toBeVisible();
      await search.fill("");
      await expect(tableRows(page).first()).toBeVisible();

      await chooseFilter(page, route.kindLabel, "All", route.filterMode);
      await chooseFilter(page, "Status", "All", route.filterMode);
      const rowsPerPage = page.locator(`#${route.rowsPerPageId}`);
      await rowsPerPage.click();
      await page.getByRole("option", { name: "20", exact: true }).click();
      await expect(rowsPerPage).toContainText("20");
      await expect(pageIndicator(page)).toHaveText(/^Page 1 of \d+$/);
      expect((await tableRows(page).allTextContents()).length).toBeLessThanOrEqual(20);
    });
  }

  test("CEO transition actions stay in the widened context menu", async ({ page }) => {
    await signIn(page, "ceo@gce.local", "/ceo/transactions");
    await chooseFilter(page, "Status", "Pending", "menu");

    const row = tableRows(page).first();
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /Under Review|Cancel/ })).toHaveCount(0);

    await row.locator("button").last().click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    expect(await menu.getByRole("menuitem").allTextContents()).toEqual(["View Details", "Under Review", "Cancel"]);
    expect(await menu.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(192);
    await expect(menu.getByRole("menuitem", { name: "Cancel", exact: true })).toHaveAttribute(
      "data-variant",
      "destructive",
    );

    await menu.getByRole("menuitem", { name: "Under Review", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  });
});
