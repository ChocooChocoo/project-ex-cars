import { expect, type Page, test } from "@playwright/test";

const seedPassword = process.env.SEED_USER_PASSWORD;
const seededVehicleId = "b0c91ff3-f130-4f08-8cdb-022c51d1b74b";

function getSeedPassword() {
  if (!seedPassword) {
    throw new Error("SEED_USER_PASSWORD is required for the CEO portal UI regression.");
  }
  return seedPassword;
}

async function signIn(page: Page, path: string) {
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill("ceo@gce.local");
  await page.getByLabel("Password", { exact: true }).fill(getSeedPassword());
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 15000 }).catch(() => undefined);
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
}

async function assertNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe("Task 17 CEO portal UI", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD is required for the CEO portal UI regression.");

  test("vehicle form is a constrained single-column flow and segmented navigation remains accessible", async ({
    page,
  }) => {
    await signIn(page, "/ceo/vehicles");

    const viewGroup = page.getByRole("radiogroup", { name: "Vehicle inventory view", exact: true });
    await expect(viewGroup).toBeVisible();
    const pending = viewGroup.getByRole("radio", { name: "Pending", exact: true });
    const vehicles = viewGroup.getByRole("radio", { name: "Vehicles", exact: true });
    await expect(pending).toHaveAttribute("aria-checked", "true");
    const listUrl = page.url();
    await vehicles.click();
    await expect(vehicles).toHaveAttribute("aria-checked", "true");
    expect(page.url()).toBe(listUrl);

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/ceo/vehicles/${seededVehicleId}`);
      await expect(page.getByRole("heading", { name: "Edit Vehicle", exact: true })).toBeVisible();

      const form = page.locator("form").first();
      const layout = await form.evaluate((element) => {
        const fields = [...element.querySelectorAll("input, textarea, [role='combobox']")].map((field) => {
          const rect = field.getBoundingClientRect();
          return { left: rect.left, top: rect.top, bottom: rect.bottom };
        });
        const submit = element.querySelector("button[type='submit']")?.getBoundingClientRect();
        const formRect = element.getBoundingClientRect();
        return {
          formWidth: formRect.width,
          fieldRects: fields,
          submitTop: submit?.top ?? 0,
          pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });

      expect(layout.formWidth).toBeLessThanOrEqual(800);
      expect(layout.fieldRects.length).toBeGreaterThan(10);
      for (const [index, field] of layout.fieldRects.entries()) {
        const previous = layout.fieldRects[index - 1];
        if (!previous) continue;
        expect(Math.abs(field.left - previous.left)).toBeLessThanOrEqual(2);
        expect(field.top).toBeGreaterThanOrEqual(previous.bottom - 1);
      }
      expect(layout.submitTop).toBeGreaterThan(layout.fieldRects.at(-1)?.bottom ?? 0);
      expect(layout.pageOverflow).toBe(false);
    }
  });

  test("content cards keep the responsive grid and restrained hierarchy", async ({ page }) => {
    await signIn(page, "/ceo/content");

    const cards = page.locator("main [data-slot='card']").filter({
      has: page.locator("[data-slot='card-action']"),
    });

    for (const viewport of [
      { width: 390, height: 844, columns: 1 },
      { width: 768, height: 900, columns: 2 },
      { width: 1440, height: 900, columns: 3 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/ceo/content");
      await expect(cards).toHaveCount(9);
      const cardMetrics = await cards.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { left: Math.round(rect.left), top: Math.round(rect.top), height: Math.round(rect.height) };
        }),
      );
      const columns = new Set(cardMetrics.map(({ left }) => left)).size;
      expect(columns).toBe(viewport.columns);
      for (const top of new Set(cardMetrics.map(({ top }) => top))) {
        const rowHeights = cardMetrics.filter((metric) => metric.top === top).map(({ height }) => height);
        expect(Math.max(...rowHeights) - Math.min(...rowHeights)).toBeLessThanOrEqual(1);
      }
      await assertNoPageOverflow(page);
    }

    const firstCard = cards.first();
    await expect(firstCard.locator("[data-slot='card-action']")).toBeVisible();
    await expect(firstCard).toHaveClass(/shadow-xs/);
    await expect(firstCard.locator("[data-slot='card-title']")).toHaveClass(/wrap-break-word/);
    await expect(firstCard.locator("[data-slot='card-content']")).toHaveClass(/flex-1/);
    await expect(firstCard.locator("[data-slot='card-content'] p").first()).toHaveClass(/wrap-break-word/);

    const publishButton = page.getByRole("button", { name: "Publish", exact: true }).first();
    if (await publishButton.count()) {
      await expect(publishButton).toHaveClass(/mt-auto/);
    }
  });

  test("roadmap expand controls fit and retain their behavior", async ({ page }) => {
    await signIn(page, "/ceo/roadmap");

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/ceo/roadmap");
      const timeline = page.getByRole("tabpanel", { name: "Timeline", exact: true });
      const expand = timeline.getByRole("button", { name: "Expand all", exact: true });
      const collapse = timeline.getByRole("button", { name: "Collapse", exact: true });
      const metrics = await Promise.all(
        [expand, collapse].map((button) =>
          button.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, rect };
          }),
        ),
      );
      expect(metrics.every(({ clientWidth, scrollWidth }) => scrollWidth <= clientWidth)).toBe(true);
      expect(metrics[0].rect.right).toBeLessThanOrEqual(metrics[1].rect.left);

      const collapsedButtonCount = await timeline.getByRole("button").count();
      await expand.click();
      await expect.poll(() => timeline.getByRole("button").count()).toBeGreaterThan(collapsedButtonCount);
      await collapse.click();
      await expect.poll(() => timeline.getByRole("button").count()).toBe(collapsedButtonCount);
      await assertNoPageOverflow(page);
    }
  });

  test("inspections and suppliers retain the shared table interactions", async ({ page }) => {
    await signIn(page, "/ceo/inspections");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("#inspections-rows-per-page")).toBeVisible();
    await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "2", exact: true }).click();
    await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
    await assertNoPageOverflow(page);

    await signIn(page, "/ceo/suppliers");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("#suppliers-rows-per-page")).toBeVisible();
    const supplierRow = page.locator("tbody tr").first();
    await supplierRow.locator("button").last().click();
    await page.getByRole("menuitem", { name: "View Documents", exact: true }).click();
    const documentsSheet = page
      .locator("[data-slot='sheet-content']")
      .filter({ has: page.getByRole("heading", { name: "Supplier Documents", exact: true }) })
      .first();
    await expect(documentsSheet).toBeVisible();
    await documentsSheet.getByRole("button", { name: "Close", exact: true }).first().click();
    await expect(documentsSheet).toBeHidden();
    await assertNoPageOverflow(page);
  });
});
