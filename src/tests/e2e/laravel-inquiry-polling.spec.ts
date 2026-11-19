import { type Browser, expect, type Page, test } from "@playwright/test";

// Phase 4 done-when: two isolated sessions exchange messages and attachments through Laravel and see each
// other's updates within one polling interval; going offline and back neither loses nor duplicates messages.
// Cross-customer access is covered by backend/tests/Feature/Messaging/InquiryTest.php.
// Runs against local Laravel (:8000) and this checkout's Next.js (E2E_BASE_URL, e.g. :3001), seeded data.
const seedPassword = process.env.SEED_USER_PASSWORD ?? "";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ONE_POLL = 4_000 + 3_000; // POLL_INTERVAL_MS plus request/render slack

// A real 1x1 PNG, so Laravel's content sniffing accepts it.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function session(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/auth/v1/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(seedPassword);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/"), { timeout: 60_000 });
  return page;
}

/** The customer's first thread the CEO can also read (CEO inbox excludes sell negotiations). */
async function sharedThreadId(customer: Page): Promise<string> {
  const id = await customer.evaluate(async (url) => {
    const res = await fetch(`${url}/api/v1/inquiries`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const body = (await res.json()) as { inquiries: { id: string; intention_kind: string }[] };
    return body.inquiries.find((i) => i.intention_kind !== "sell_negotiation")?.id ?? null;
  }, apiUrl);
  expect(id, "seeded customer needs a non-sell inquiry").toBeTruthy();
  return id as string;
}

async function openThread(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  // Freshly seeded staff see the onboarding tour, a modal that hides the thread from role queries.
  const skip = page.getByRole("button", { name: /^skip/i });
  await skip
    .first()
    .waitFor({ timeout: 5_000 })
    .then(() => skip.first().click())
    .catch(() => undefined);
  await expect(page.getByPlaceholder("Type a message...", { exact: true })).toBeVisible({ timeout: 30_000 });
}

async function send(page: Page, text: string, file?: { name: string; mimeType: string; buffer: Buffer }) {
  if (file) await page.getByLabel("Attach an image or PDF").setInputFiles(file);
  await page.getByPlaceholder("Type a message...", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible({ timeout: 20_000 });
}

test.describe("Laravel inquiry polling", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD is required.");

  test("two sessions exchange messages and an attachment within one polling interval", async ({ browser }) => {
    test.setTimeout(180_000);
    const customer = await session(browser, "customer@gce.local");
    const ceo = await session(browser, "ceo@gce.local");
    const id = await sharedThreadId(customer);
    await openThread(customer, `/customer/my-inquiries/${id}`);
    await openThread(ceo, `/ceo/inquiries/${id}`);

    const fromCustomer = `poll-customer-${Date.now()}`;
    await send(customer, fromCustomer, { name: "odometer.png", mimeType: "image/png", buffer: PNG });
    await expect(ceo.getByText(fromCustomer, { exact: true })).toBeVisible({ timeout: ONE_POLL });
    // The attachment arrives with its message, as a signed Laravel link (never a storage path).
    const preview = ceo.getByRole("img", { name: "odometer.png" }).last();
    await expect(preview).toBeVisible({ timeout: ONE_POLL });

    const fromCeo = `poll-ceo-${Date.now()}`;
    await send(ceo, fromCeo);
    await expect(customer.getByText(fromCeo, { exact: true })).toBeVisible({ timeout: ONE_POLL });
    await expect(customer.getByText(fromCeo, { exact: true })).toHaveCount(1);
  });

  test("going offline and back does not lose or duplicate messages", async ({ browser }) => {
    test.setTimeout(180_000);
    const customer = await session(browser, "customer@gce.local");
    const ceo = await session(browser, "ceo@gce.local");
    const id = await sharedThreadId(customer);
    await openThread(customer, `/customer/my-inquiries/${id}`);
    await openThread(ceo, `/ceo/inquiries/${id}`);

    await ceo.context().setOffline(true);
    const sent = [`offline-a-${Date.now()}`, `offline-b-${Date.now()}`];
    for (const text of sent) await send(customer, text);
    await ceo.waitForTimeout(ONE_POLL); // polls fail while offline
    await ceo.context().setOffline(false);

    for (const text of sent) {
      await expect(ceo.getByText(text, { exact: true })).toBeVisible({ timeout: ONE_POLL });
    }
    // Several more polls overlap the same window; each message still shows once.
    await ceo.waitForTimeout(ONE_POLL * 2);
    for (const text of sent) await expect(ceo.getByText(text, { exact: true })).toHaveCount(1);
  });
});
