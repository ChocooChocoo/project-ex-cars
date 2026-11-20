import { type Page, test } from "@playwright/test";

import { expect, open } from "./support/t01";

const PORTALS = [
  ["sales_manager", "/sales_manager/vehicles"],
  ["customer", "/customer/buying-requirements"],
  ["supplier", "/supplier/portal"],
] as const;

async function portalFixture(page: Page, baseURL: string, role: string) {
  await page.context().addCookies([{ name: "gce-role", value: role, url: baseURL }]);
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({
      json: {
        id: "00000000-0000-4000-8000-000000000001",
        email: `${role}@gce.local`,
        email_verified: true,
        role,
        profile: { full_name: "Mariel Ramos", account_state: "active", tutorial_completed_at: "2026-11-20" },
      },
    }),
  );
  await page.route("**/api/v1/notifications*", (route) => route.fulfill({ json: { notifications: [] } }));
}

for (const [role, path] of PORTALS) {
  test(`${path} switches its sidebar wordmark without a reload`, async ({ page, baseURL }) => {
    await portalFixture(page, baseURL ?? "http://localhost:3000", role);
    await page.route("**/api/v1/staff/vehicles", (route) =>
      route.fulfill({ json: { vehicles: [], proposals: [], reconditioning_by_vehicle: {}, default_markup_pct: 10 } }),
    );
    await page.route("**/api/v1/supplier/dashboard", (route) =>
      route.fulfill({
        json: { company_name: "Santos Auto Supply", counts: { transactions: 0, posted: 0, purchased: 0 }, posts: [] },
      }),
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await open(page, path);

    const sidebar = page.locator("[data-sidebar='sidebar']");
    const light = sidebar.locator('img[src$="GCE-LOGO-LIGHTMODE.png"]');
    const dark = sidebar.locator('img[src$="GCE-LOGO-DARKMODE.png"]');
    const toggle = page.getByRole("button", { name: /Current theme:/ });
    await expect(light).toBeVisible();
    await expect(light).toHaveJSProperty("complete", true);
    await expect(dark).toBeHidden();
    if ((await toggle.getAttribute("aria-label"))?.includes("system")) await toggle.click();
    await toggle.click();
    await expect(dark).toBeVisible();
    await expect(light).toBeHidden();
    await toggle.click();
    await expect(light).toBeVisible();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(dark).toBeVisible();
    await expect(dark).toHaveJSProperty("naturalWidth", 2016);

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await expect(dark).toBeHidden();
    await expect(sidebar.getByRole("link", { name: /Global Car Exchange/ }).locator("svg")).toBeVisible();
  });
}

test("marketing can rotate an uncropped 360° view on desktop and mobile", async ({ page, baseURL }) => {
  const vehicleId = "00000000-0000-4000-8000-000000000002";
  await portalFixture(page, baseURL ?? "http://localhost:3000", "marketing_specialist");
  await page.route(`**/api/v1/staff/vehicles/${vehicleId}`, (route) =>
    route.fulfill({
      json: {
        vehicle: { id: vehicleId, make: "Toyota", model: "Vios", stock_code: "GCE-001", listing_state: "available" },
        media: [1, 2, 3].map((n) => ({
          id: `frame-${n}`,
          media_kind: "360_view",
          storage_path: `${vehicleId}/frame-${n}.png`,
          display_order: n,
        })),
        proposal: null,
        reconditioning: null,
        inspection: null,
        revision: null,
      },
    }),
  );
  await page.route(`**/${vehicleId}/frame-*.png`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500"><path d="M0 200H1200V400H0z"/></svg>',
    }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, `/marketing_specialist/vehicles/${vehicleId}`);

  const spin = page.getByRole("slider", { name: /360° view/ });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(spin).toBeVisible();
    await expect(spin.locator("img").first()).toHaveCSS("object-fit", "contain");
  }
  const frame = await spin.getAttribute("aria-valuenow");
  await spin.press("ArrowRight");
  await expect(spin).not.toHaveAttribute("aria-valuenow", frame ?? "");
  await expect(page.getByRole("button", { name: "Interior", exact: true })).toHaveCount(0);

  await page.getByRole("combobox", { name: "Kind" }).click();
  await expect(page.getByRole("option", { name: "360° Frame" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Interior" })).toHaveCount(0);
  await page.keyboard.press("Escape");
});
