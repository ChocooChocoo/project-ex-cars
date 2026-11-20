import { expect as baseExpect, type Page } from "@playwright/test";

import { canUseLaravelFixtures, laravelFixture } from "./laravel-fixture";

// Shared steps for the T01 branch specs. The dev server compiles each route on first use, so
// assertions wait longer than Playwright's default 5 s.
export const expect = baseExpect.configure({ timeout: 20_000 });

export const seedPassword = process.env.SEED_USER_PASSWORD;

export const png = (name: string) => ({
  name,
  mimeType: "image/png",
  // Padded just past the 2 MB upload cap, like a phone photo, so every upload runs the browser shrink
  // step (src/lib/uploads/compress-image.ts). Storage receives a JPEG under 1 KB.
  buffer: Buffer.concat([
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    ),
    Buffer.alloc(2 * 1024 * 1024),
  ]),
});

// A future whole-hour slot; the offset keeps parallel requests in one run apart.
export function futureSlot(offsetHours = 0): string {
  const base = new Date(2033, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27), 9, 0, 0);
  base.setHours(base.getHours() + offsetHours + Math.floor(Math.random() * 6));
  // GCE is closed on Sundays.
  if (base.getDay() === 0) base.setDate(base.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:00`;
}

export async function signInAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(seedPassword ?? "");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page
    .waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 30_000 })
    .catch(() => undefined);
  await finishOnboarding(page);
}

// Freshly seeded staff get the onboarding tour, a modal that hides every page from role queries. Mark it done
// through the same endpoint the tour's Skip button calls, so the specs see the pages they drive.
export async function finishOnboarding(page: Page) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  await page
    .evaluate(async (url) => {
      const xsrf = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="));
      await fetch(`${url}/api/v1/me/tutorial`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "X-XSRF-TOKEN": decodeURIComponent(xsrf?.slice(11) ?? "") },
      });
    }, apiUrl)
    .catch(() => undefined);
}

// Opens a page and waits for hydration, so the first fill or click is not lost.
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

export async function pick(page: Page, id: string, option: string) {
  await page.locator(`#${id}`).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

export async function pickByLabel(page: Page, label: string, option?: string) {
  await page.getByRole("combobox", { name: label }).click();
  await (option ? page.getByRole("option", { name: option }) : page.getByRole("option").first()).click();
}

export async function uploadBuyerId(page: Page, index: 0 | 1, idType: string, side: "Front" | "Back") {
  const card = page
    .locator("li")
    .filter({ hasText: `Valid ID #${index + 1}` })
    .first();
  await expect(card).toBeVisible();
  const trigger = page.locator(`#id-type-${index}`);
  if (await trigger.isEnabled()) await pick(page, `id-type-${index}`, idType);
  const inputs = card.locator('input[type="file"]');
  const count = await inputs.count();
  if (count === 0) return;
  const target = side === "Front" ? 0 : count >= 2 ? 1 : 0;
  await inputs.nth(target).setInputFiles(png(`${idType}-${side}.png`));
  await expect(inputs).toHaveCount(count - 1, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

export async function uploadBuyerBilling(page: Page) {
  const card = page.locator("li").filter({ hasText: "Proof of billing" }).first();
  await expect(card).toBeVisible();
  const input = card.locator('input[type="file"]');
  await input.setInputFiles(png("Proof of Billing.png"));
  await expect(input).toHaveCount(0, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

// The buyer's side up to Submit Request: Buy Now, 2 IDs (front and back each) + proof of billing, method,
// arrangement.
// T04/T10: a slot is a date plus a whole hour (9 AM–9 PM Manila) picked from the list. `when` is "YYYY-MM-DDTHH:00".
export async function fillSlot(page: Page, when: string) {
  const [date, time] = when.split("T");
  const hour = Number(time.slice(0, 2));
  const label = `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? "AM" : "PM"}`;
  await page.locator("#schedule-date").fill(date);
  await page.locator("#schedule-hour").click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

// The meet-up or delivery address starts from the customer's PSGC profile address (T10).
export function setCustomerAddress() {
  laravelFixture("set-customer-address");
}

export async function buyerRequest(
  page: Page,
  vehicleId: string,
  options: {
    method: "Cash" | "Financing" | "Bank Transfer";
    arrangement: "GCE Visit" | "CALABARZON Meet-up" | "Delivery";
    when?: string;
    // Financing: the payment term the buyer asks for (defaults to 1 year).
    term?: "6 months" | "1 year" | "2 years" | "3 years" | "5 years";
  },
): Promise<string> {
  await open(page, `/customer/showroom/${vehicleId}`);
  await page.getByRole("button", { name: "Buy Now" }).click();
  await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  const id = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";

  await uploadBuyerId(page, 0, "Passport", "Front");
  await uploadBuyerId(page, 0, "Passport", "Back");
  await uploadBuyerId(page, 1, "Driver's License", "Front");
  await uploadBuyerId(page, 1, "Driver's License", "Back");
  await uploadBuyerBilling(page);
  // T04: Financing is a Payment Option. T06: Full Payment is Cash or Bank Transfer (via PayMongo); PayMongo is
  // the channel, so it is never an option of its own.
  if (options.method === "Financing") await pick(page, "payment_option", "Financing");
  else await pick(page, "payment_method", options.method === "Bank Transfer" ? "Bank Transfer (via PayMongo)" : "Cash");
  await pick(page, "arrangement_kind", options.arrangement);
  if (options.when) await fillSlot(page, options.when);
  // BH-8: a halfway meet-up pins its point from the device location; the buyer types the block or landmark.
  const landmark = page.getByLabel("Block, lot, street / landmark");
  if (await landmark.isVisible().catch(() => false)) await landmark.fill("Beside the covered court");
  // Every financing request asks for a term.
  if (options.term || options.method === "Financing") await pick(page, "requested_term", options.term ?? "1 year");
  const acknowledge = page.getByLabel(/I have reviewed this car's condition/);
  if (await acknowledge.isVisible()) await acknowledge.check();
  // Delivery: the buyer agrees to the delivery terms notice before the request can be sent.
  const agree = page.locator("#agree-delivery-terms");
  if (await agree.isVisible()) await agree.check();
  await page.getByRole("button", { name: "Save Details" }).click();
  await expect(page.getByText("Details saved.")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Submit Request" }).click();
  await expect(page.getByText(/Request sent|yours is On Hold/)).toBeVisible();
  return id;
}

export async function verifyAll(page: Page, expected: number) {
  const verify = page.getByRole("button", { name: "Verify", exact: true });
  await expect(verify).toHaveCount(expected);
  for (let left = expected; left > 0; left--) {
    await verify.first().click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(verify).toHaveCount(left - 1);
  }
}

// Sales Manager: verify the buyer's 3 papers and approve the request.
export async function approveAsSalesManager(page: Page, transactionId: string) {
  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${transactionId}`);
  await verifyAll(page, 5);
  // The last verification must have landed before the approval counts the verified papers.
  await page.waitForLoadState("networkidle");
  // A cash Meet Halfway is approved together with its team.
  if (await page.getByText("Meet-up team", { exact: true }).isVisible()) {
    await pickByLabel(page, "Confidential Informant");
    await pickByLabel(page, "Mechanic");
  }
  await page.getByRole("button", { name: /^Transition Approve/ }).click();
  const dialog = page.getByRole("alertdialog");
  if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
  }
  await expect(page.getByText("Transaction moved to approved.")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

// T11: the Head Accountant no longer reviews the terms, so they go straight to the CEO.
export async function proposeTerms(page: Page, months: number, price: number, downpayment: number) {
  await page.getByLabel("Payment duration (months)").fill(String(months));
  await page.getByLabel("Total with financing (₱)").fill(String(price));
  await page.getByLabel("Initial Downpayment (₱)").fill(String(downpayment));
  await page.getByLabel("Monthly payment (₱)").fill(String(Math.ceil((price - downpayment) / months)));
  await page.getByLabel("First installment due").fill("2033-12-01");
  await page.getByRole("button", { name: "Send to CEO" }).click();
  await expect(page.getByText("Terms sent to the CEO for confirmation.")).toBeVisible();
}

// T11 removed the Head Accountant's review: the Sales Manager's terms now wait for the CEO directly. The step
// is kept so the T01/T10 specs still read in their original order; it only confirms the terms are in review.
export async function headAccountantApproves(page: Page, id: string) {
  await signInAs(page, "head_accountant@gce.local");
  await open(page, `/head_accountant/transactions/${id}`);
  await expect(page.getByText("Review the financing")).toHaveCount(0);
  await expect(page.getByText("Waiting for the CEO")).toBeVisible();
}

export async function ceoConfirms(page: Page, id: string) {
  await signInAs(page, "ceo@gce.local");
  await open(page, `/ceo/transactions/${id}`);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Financing confirmed; the buyer is notified.")).toBeVisible();
}

export const markSold = (page: Page) => page.getByRole("button", { name: /Mark Sold to This Buyer/ });

// The payment due is read-only (amount, kind and method come from the sale), so recording it is one click. A
// Bank Transfer buy, paid online, only offers the manual form, which takes the amount and kind typed here.
export async function recordPayment(page: Page, amount: string, kind: string) {
  const manual = page.locator("#manual_amount");
  if (await manual.isVisible().catch(() => false)) {
    await manual.fill(amount);
    await pick(page, "manual_kind", kind);
  }
  await page.getByRole("button", { name: "Record Payment" }).click();
}

// A recorded payment hides the form until the Head Accountant checks it, so each one is recorded, then verified.
export async function recordAndVerifyPayments(page: Page, payments: readonly (readonly [string, string])[]) {
  for (const [amount, kind] of payments) {
    await recordPayment(page, amount, kind);
    await verifyAll(page, 1);
  }
}

// The field case a request's "Open field case" link points at, without the role prefix.
export async function fieldCasePath(page: Page) {
  const link = page.getByRole("link", { name: "Open field case" });
  await expect(link).toBeVisible();
  return new URL((await link.getAttribute("href")) ?? "", page.url()).pathname.replace(/^\/[^/]+/, "");
}

// Phase 3: the Sales Manager writes the pre-made contract and the Head Accountant approves it.
export async function writeAndApproveContract(page: Page, id: string) {
  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${id}`);
  await page.getByRole("button", { name: "Start from the pre-made contract" }).click();
  await page.getByRole("button", { name: "Send for approval" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Send for approval", exact: true }).click();
  await expect(page.getByText("Contract sent to the Head Accountant.")).toBeVisible();
  await signInAs(page, "head_accountant@gce.local");
  await open(page, `/head_accountant/transactions/${id}`);
  await page.getByRole("button", { name: "Approve contract" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Contract approved. The buyer can sign it.")).toBeVisible();
}

export async function buyerSignsContract(page: Page, id: string) {
  await signInAs(page, "customer@gce.local");
  await open(page, `/my-transactions/${id}`);
  await page.getByLabel("Type your full name").fill("Maria Santos");
  await drawSignature(page);
  await expect(page.getByRole("button", { name: "Sign contract" })).toBeEnabled();
  await page.getByRole("button", { name: "Sign contract" }).click();
  await expect(page.getByText("Contract signed.")).toBeVisible();
}

// The signature pad is a canvas: draw a short stroke so the form records a signature.
export async function drawSignature(page: Page) {
  const pad = page.getByRole("img", { name: /Signature pad/ });
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + 30, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 80, { steps: 10 });
  await page.mouse.up();
}

// PayMongo checkout is external, so the financing downpayment is recorded as a verified bank transfer
// for the rest of the browser chain.
export async function recordFinancingDownpayment(transactionId: string) {
  laravelFixture("record-financing-downpayment", transactionId);
}

export async function markFinancingFullyPaid(transactionId: string) {
  laravelFixture("mark-financing-paid", transactionId);
}

// The delivery fee and downpayment are paid online through PayMongo; record the same verified rows a
// successful checkout creates so the rest of the delivery chain can run.
// Phase 5 stand-in for the Phase 6 payment screens: the cash payment, recorded and verified, straight into Laravel.
export async function recordVerifiedPayment(transactionId: string, amount: number) {
  laravelFixture("record-verified-payment", transactionId, amount);
}

// BC-2: a GCE-visit sale now has a contract; record it signed for specs that are not about the signing.
export async function signContract(transactionId: string) {
  laravelFixture("sign-contract", transactionId);
}

export async function recordDeliveryPayments(transactionId: string) {
  laravelFixture("record-delivery-payments", transactionId);
}

// Head Accountant verifies every payment still waiting on the request.
export async function verifyPayments(page: Page, id: string) {
  await signInAs(page, "head_accountant@gce.local");
  await open(page, `/head_accountant/transactions/${id}`);
  await verifyAll(page, await page.getByRole("button", { name: "Verify", exact: true }).count());
}

// Phase 2 papers chain at GCE: the Sales Manager requests the papers, the CI hands them over from
// Vehicle Papers, the Sales Manager receives them and marks the car sold. The payment must already be checked.
export async function papersThenSold(page: Page, id: string, vehicleLabel: string) {
  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${id}`);
  await page.getByRole("button", { name: "Request papers release" }).click();
  await expect(page.getByText("Papers requested from the Confidential Informant.")).toBeVisible();
  await signInAs(page, "confidential_informant@gce.local");
  await open(page, "/confidential_informant/vehicle-papers");
  await page.getByRole("tab", { name: /To buyers/ }).click();
  // Earlier runs can leave rows for the same test car; act on the newest one still waiting for the CI (rows are oldest first).
  const request = page.getByRole("row").filter({ hasText: vehicleLabel }).filter({ hasText: "Papers Requested" });
  await request
    .getByRole("button", { name: /Actions for/ })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "Mark Released" }).click();
  await expect(page.getByText("Papers released to the Sales Manager.")).toBeVisible();
  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${id}`);
  await page.getByRole("button", { name: "Receive papers" }).click();
  await expect(page.getByText("Papers received.")).toBeVisible();
  await signContract(id);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await markSold(page).click();
  await expect(page.getByText("Transaction moved to completed.")).toBeVisible();
}

// Field flows (meet-up, delivery): the assigned CI records the papers, Buyer Met, the signing (paper
// contract, or the buyer's in-app signature already given), a signed copy, the cash when paid on site,
// and hands the papers to the buyer. BH-2: the Mechanic keeps no contract copy.
export async function ciClosesFieldCase(
  page: Page,
  casePath: string,
  options: { papersReleased?: boolean; cash?: boolean } = {},
) {
  await signInAs(page, "confidential_informant@gce.local");
  await open(page, `/confidential_informant${casePath}`);
  if (!options.papersReleased) {
    await page.getByRole("button", { name: "Record papers released to me" }).click();
    await expect(page.getByText("Papers recorded as released to you.")).toBeVisible();
  }
  await page.getByRole("button", { name: "Record Buyer Met" }).click();
  await expect(page.getByText("Buyer Met recorded.")).toBeVisible();
  await page.getByRole("button", { name: "Report contract signed" }).click();
  await expect(page.getByText("Signing reported to GCE.")).toBeVisible();
  await page.getByRole("button", { name: "Record my signed copy" }).click();
  await expect(page.getByText("Your signed copy is recorded.")).toBeVisible();
  if (options.cash) {
    await page.getByRole("button", { name: "Report payment received" }).click();
    await expect(page.getByText("Payment reported to the Sales Manager.")).toBeVisible();
  }
  await page.getByRole("button", { name: "Hand papers to buyer" }).click();
  await expect(page.getByText("Papers handed to the buyer.")).toBeVisible();
}

// ---------------------------------------------------------------------------------------------
// Test-data helpers. Used only to move the clock forward for time-based rules (backdating a meet-up, a deadline
// or installments), to reset test state and to read results; never to perform a flow step.
// Phase 7: db() keeps the PostgREST-style calls the specs make (from/select/update/eq/neq/in/is/order/limit/
// single) but runs them through Laravel's test-only `e2e:fixture query` (local, testing or staging only).
// ---------------------------------------------------------------------------------------------
type QuerySpec = {
  table: string;
  select?: string;
  filters: [string, string, unknown][];
  order?: [string, boolean];
  limit?: number;
  update?: Record<string, unknown>;
  single?: boolean;
};

// biome-ignore lint/suspicious/noExplicitAny: spec assertions read arbitrary columns, as with the Supabase client.
type QueryResult = { data: any; error: Error | null };

class FixtureQuery implements PromiseLike<QueryResult> {
  private readonly spec: QuerySpec;

  constructor(table: string) {
    this.spec = { table, filters: [] };
  }

  select(columns = "*") {
    this.spec.select = columns;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.spec.update = values;
    return this;
  }

  eq(column: string, value: unknown) {
    this.spec.filters.push(["eq", column, value]);
    return this;
  }

  neq(column: string, value: unknown) {
    this.spec.filters.push(["neq", column, value]);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.spec.filters.push(["in", column, values]);
    return this;
  }

  is(column: string, value: null) {
    this.spec.filters.push(["is", column, value]);
    return this;
  }

  /** Only `.not(column, "is", null)`, the one form the specs use. */
  not(column: string, _operator: "is", _value: null) {
    this.spec.filters.push(["notnull", column, null]);
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.spec.order = [column, options.ascending ?? true];
    return this;
  }

  limit(count: number) {
    this.spec.limit = count;
    return this;
  }

  single() {
    this.spec.single = true;
    return this;
  }

  maybeSingle() {
    return this.single();
  }

  private run(): QueryResult {
    try {
      const encoded = Buffer.from(JSON.stringify(this.spec)).toString("base64url");
      return { data: JSON.parse(laravelFixture("query", encoded)).data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  // biome-ignore lint/suspicious/noThenProperty: awaitable like the Supabase query builder the specs were written for.
  then<A = QueryResult, B = never>(
    onFulfilled?: ((value: QueryResult) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(onFulfilled, onRejected);
  }
}

export function db() {
  return { from: (table: string) => new FixtureQuery(table) };
}

export async function customerId(): Promise<string> {
  return laravelFixture("customer-id");
}

// Clears no-shows and strikes the specs gave customer@gce.local, so later specs are not restricted.
export async function resetCustomerStanding(): Promise<void> {
  if (canUseLaravelFixtures()) laravelFixture("reset-standing");
}
