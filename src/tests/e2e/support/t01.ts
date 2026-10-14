import { expect as baseExpect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Shared steps for the T01 branch specs. The dev server compiles each route on first use, so
// assertions wait longer than Playwright's default 5 s.
export const expect = baseExpect.configure({ timeout: 20_000 });

export const seedPassword = process.env.SEED_USER_PASSWORD;

export const png = (name: string) => ({
  name,
  mimeType: "image/png",
  // Padded to 2 MB, the size of a phone photo: tiny fixtures hid the 1 MB Server Action body limit.
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
    method: "Cash" | "Financing" | "Bank Transfer";
    arrangement: "GCE Visit" | "CALABARZON Meet-up" | "Delivery";
    when?: string;
    // A financed meet-up: the payment term the buyer asks for.
    term?: "1 year" | "2 years" | "3 years" | "5 years";
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
  if (options.term) await pick(page, "requested_term", options.term);
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
    await expect(verify).toHaveCount(left - 1);
  }
}

// Sales Manager: verify the buyer's 3 papers and approve the request.
export async function approveAsSalesManager(page: Page, transactionId: string) {
  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${transactionId}`);
  await verifyAll(page, 3);
  // The last verification must have landed before the approval counts the verified papers.
  await page.waitForLoadState("networkidle");
  // A cash Meet Halfway is approved together with its team.
  if (await page.getByText("Meet-up team", { exact: true }).isVisible()) {
    await pickByLabel(page, "Confidential Informant");
    await pickByLabel(page, "Mechanic");
  }
  await page.getByRole("button", { name: /^Transition Approve/ }).click();
  await expect(page.getByText("Transaction moved to approved.")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

// §6 steps 6–10: the Sales Manager proposes terms, the Head Accountant approves, the CEO confirms.
export async function proposeTerms(page: Page, months: number, price: number, downpayment: number) {
  await page.getByLabel("Payment duration (months)").fill(String(months));
  await page.getByLabel("Vehicle price (₱)").fill(String(price));
  await page.getByLabel("Initial Downpayment (₱)").fill(String(downpayment));
  await page.getByLabel("Monthly payment (₱)").fill(String(Math.ceil((price - downpayment) / months)));
  await page.getByLabel("First installment due").fill("2033-12-01");
  await page.getByLabel("Missed payment policy").fill("From the 4th missed month GCE takes back the vehicle.");
  await page.getByRole("button", { name: "Send to Head Accountant" }).click();
  await expect(page.getByText("Terms sent to the Head Accountant.")).toBeVisible();
}

export async function headAccountantApproves(page: Page, id: string) {
  await signInAs(page, "head_accountant@gce.local");
  await open(page, `/head_accountant/transactions/${id}`);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Terms sent to the CEO.")).toBeVisible();
}

export async function ceoConfirms(page: Page, id: string) {
  await signInAs(page, "ceo@gce.local");
  await open(page, `/ceo/transactions/${id}`);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Financing confirmed; the buyer is notified.")).toBeVisible();
}

export const markSold = (page: Page) => page.getByRole("button", { name: /Mark Sold to This Buyer/ });

export async function recordPayment(page: Page, amount: string, method: string, kind: string) {
  await page.locator("#pay_amount").fill(amount);
  await pick(page, "pay_method", method);
  await pick(page, "pay_kind", kind);
  await page.getByRole("button", { name: "Record Payment" }).click();
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
  await expect(page.getByText("Contract sent to the Head Accountant.")).toBeVisible();
  await signInAs(page, "head_accountant@gce.local");
  await open(page, `/head_accountant/transactions/${id}`);
  await page.getByRole("button", { name: "Approve contract" }).click();
  await expect(page.getByText("Contract approved. The buyer can sign it.")).toBeVisible();
}

export async function buyerSignsContract(page: Page, id: string) {
  await signInAs(page, "customer@gce.local");
  await open(page, `/my-transactions/${id}`);
  await page.getByLabel("Type your full name to sign").fill("Maria Santos");
  await page.getByRole("button", { name: "Sign contract" }).click();
  await expect(page.getByText("Contract signed.")).toBeVisible();
}

// Head Accountant verifies every payment still waiting on the request.
export async function verifyPayments(page: Page, id: string) {
  await signInAs(page, "head_accountant@gce.local");
  await open(page, `/head_accountant/transactions/${id}`);
  await verifyAll(page, await page.getByRole("button", { name: "Verify", exact: true }).count());
}

// Phase 2 papers chain at GCE: the Sales Manager requests the papers, the CI hands them over from Field
// Cases, the Sales Manager receives them and marks the car sold. The payment must already be checked.
export async function papersThenSold(page: Page, id: string, vehicleLabel: string) {
  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${id}`);
  await page.getByRole("button", { name: "Request papers release" }).click();
  await expect(page.getByText("Papers requested from the Confidential Informant.")).toBeVisible();
  await signInAs(page, "confidential_informant@gce.local");
  await open(page, "/confidential_informant/field-cases");
  const request = page.getByRole("listitem").filter({ hasText: vehicleLabel });
  await request.getByRole("button", { name: "Approve and hand over" }).click();
  await expect(page.getByText("Papers handed over to the Sales Manager.")).toBeVisible();
  await signInAs(page, "sales_manager@gce.local");
  await open(page, `/sales_manager/transactions/${id}`);
  await page.getByRole("button", { name: "Receive papers" }).click();
  await expect(page.getByText("Papers received.")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await markSold(page).click();
  await expect(page.getByText("Transaction moved to completed.")).toBeVisible();
}

// Field flows (meet-up, delivery): the assigned CI records the papers, Buyer Met, the signing (paper
// contract, or the buyer's in-app signature already given), a signed copy, the cash when paid on site,
// and hands the papers to the buyer. The Mechanic's copy is recorded when the flow needs it.
export async function ciClosesFieldCase(
  page: Page,
  casePath: string,
  options: { papersReleased?: boolean; cash?: boolean; mechanicCopy?: boolean } = {},
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
  if (options.mechanicCopy) {
    await signInAs(page, "mechanic@gce.local");
    await open(page, `/mechanic${casePath}`);
    await page.getByRole("button", { name: "Record my signed copy" }).click();
    await expect(page.getByText("Your signed copy is recorded.")).toBeVisible();
  }
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
