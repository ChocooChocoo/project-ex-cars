import { expect as baseExpect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Shared steps for the T01 branch specs. The dev server compiles each route on first use, so
// assertions wait longer than Playwright's default 5 s.
export const expect = baseExpect.configure({ timeout: 20_000 });

export const seedPassword = process.env.SEED_USER_PASSWORD;

export const png = (name: string) => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  ),
});

// A future whole-hour slot; the offset keeps parallel requests in one run apart.
export function futureSlot(offsetHours = 0): string {
  const base = new Date(2033, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27), 9, 0, 0);
  base.setHours(base.getHours() + offsetHours + Math.floor(Math.random() * 6));
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

async function upload(page: Page, kind: "Valid ID" | "Proof of Billing", idType?: string) {
  await pick(page, "cust-doc-kind", kind);
  if (idType) await pick(page, "cust-doc-id-type", idType);
  await page
    .locator('input[type="file"]')
    .last()
    .setInputFiles(png(`${kind}.png`));
  const uploadButton = page.getByRole("button", { name: "Upload", exact: true });
  await uploadButton.click();
  await expect(uploadButton).toBeEnabled();
  await page.waitForLoadState("networkidle");
}

// The buyer's side up to Submit Request: Buy Now, 2 IDs + proof of billing, method, arrangement.
export async function buyerRequest(
  page: Page,
  vehicleId: string,
  options: {
    method: "Cash" | "Financing";
    arrangement: "GCE Visit" | "CALABARZON Meet-up" | "Delivery";
    when?: string;
  },
): Promise<string> {
  await open(page, `/customer/showroom/${vehicleId}`);
  await page.getByRole("button", { name: "Buy Now" }).click();
  await page.waitForURL(/\/my-transactions\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  const id = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? "";

  await upload(page, "Valid ID", "Passport");
  await upload(page, "Valid ID", "Driver's License");
  await upload(page, "Proof of Billing");
  await pick(page, "payment_method", options.method);
  await pick(page, "arrangement_kind", options.arrangement);
  if (options.when) await page.locator("#schedule").fill(options.when);
  if (options.arrangement !== "GCE Visit") await page.locator("#location").fill("SM Calamba parking, Laguna");
  const acknowledge = page.getByLabel(/I have reviewed this car's condition/);
  if (await acknowledge.isVisible()) await acknowledge.check();
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
    await expect(verify).toHaveCount(left - 1);
  }
}

// Sales Manager: verify the buyer's 3 papers and approve the request.
export async function approveAsSalesManager(page: Page, transactionId: string) {
  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${transactionId}`);
  await verifyAll(page, 3);
  await page.getByRole("button", { name: /^Transition Approve/ }).click();
  await expect(page.getByText("Transaction moved to approved.")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

// ---------------------------------------------------------------------------------------------
// Service-role helpers. Used only to move the clock forward for time-based rules (backdating a
// meet-up, a deadline or installments) and to reset test state; never to perform a flow step.
// ---------------------------------------------------------------------------------------------
export function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false },
  });
}

export async function customerId(): Promise<string> {
  const { data } = await db().auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((u) => u.email === "customer@gce.local")?.id ?? "";
}

// Clears no-shows and strikes the specs gave customer@gce.local, so later specs are not restricted.
export async function resetCustomerStanding(): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  await db()
    .from("customer_standing")
    .delete()
    .eq("account_id", await customerId());
}
