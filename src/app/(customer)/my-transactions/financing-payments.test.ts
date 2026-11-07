import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, authorizeAction, createCheckoutSession, retrieveCheckoutSession, markCheckoutPaid } = vi.hoisted(() => {
  const rows: Record<string, unknown> = {};
  const writes: { table: string; payload: unknown }[] = [];
  const errors = { insert: null as { code?: string; message: string } | null };
  const from = (table: string) => {
    let inserting = false;
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: inserting ? errors.insert : null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "in", "is"]) builder[step] = () => builder;
    builder.insert = (payload: unknown) => {
      inserting = true;
      writes.push({ table, payload });
      return builder;
    };
    builder.delete = () => {
      writes.push({ table, payload: { op: "delete" } });
      rows[table] = [];
      return builder;
    };
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: Supabase queries are awaitable.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return {
    db: { rows, writes, errors, from },
    authorizeAction: vi.fn(),
    createCheckoutSession: vi.fn(),
    retrieveCheckoutSession: vi.fn(),
    markCheckoutPaid: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Map([["origin", "https://gce.test"]]) }));
vi.mock("@/lib/auth/action-guard", () => ({ authorizeAction }));
vi.mock("@/lib/payments/paymongo", () => ({ createCheckoutSession, retrieveCheckoutSession }));
vi.mock("@/lib/payments/checkout-paid", () => ({ markCheckoutPaid }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: buyerId } } }) },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { startInstallmentCheckout } from "./actions";

const buyerId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const accountId = "33333333-3333-4333-8333-333333333333";
const firstId = "44444444-4444-4444-8444-444444444444";
const futureId = "55555555-5555-4555-8555-555555555555";
const schedule = [
  { id: futureId, account_id: accountId, state: "upcoming", due_date: "2030-02-15", amount_due: 1500, sequence_no: 2 },
  { id: firstId, account_id: accountId, state: "due", due_date: "2030-01-15", amount_due: 1500, sequence_no: 1 },
];

function form(advanced = false, ids: string[] = []) {
  const fd = new FormData();
  fd.set("transaction_id", transactionId);
  if (advanced) fd.set("advanced", "yes");
  for (const id of ids) fd.append("installment_ids", id);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_123");
  db.writes.length = 0;
  db.errors.insert = null;
  authorizeAction.mockResolvedValue({ ok: true });
  createCheckoutSession.mockResolvedValue({ id: "cs_1", checkoutUrl: "https://paymongo.test/cs_1" });
  db.rows.transactions = { id: transactionId, customer_id: buyerId, current_state: "approved" };
  db.rows.installment_accounts = { id: accountId, state: "active", installments: schedule };
  db.rows.payment_records = [];
});

describe("customer financing checkout", () => {
  it("starts PayMongo for the next unpaid installment and records it unverified", async () => {
    await expect(startInstallmentCheckout(form())).resolves.toEqual({
      success: true,
      url: "https://paymongo.test/cs_1",
    });
    expect(authorizeAction).toHaveBeenCalledWith(["customer"]);
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        referenceNumber: transactionId,
        lineItems: [expect.objectContaining({ amount: 1500 })],
      }),
    );
    expect(db.writes).toEqual([
      {
        table: "payment_records",
        payload: [
          expect.objectContaining({
            installment_id: firstId,
            amount: 1500,
            method: "paymongo",
            payment_kind: "installment",
            submitted_by: buyerId,
            paymongo_checkout_id: "cs_1",
          }),
        ],
      },
    ]);
  });

  it("sends every selected installment as its own PayMongo line", async () => {
    await expect(startInstallmentCheckout(form(true, [futureId, firstId]))).resolves.toMatchObject({ success: true });
    const call = createCheckoutSession.mock.calls[0][1] as { lineItems: { amount: number }[] };
    expect(call.lineItems.map((line) => line.amount)).toEqual([1500, 1500]);
    expect((db.writes[0].payload as { amount: number }[]).map((row) => row.amount)).toEqual([1500, 1500]);
  });

  it("requires a customer and ownership", async () => {
    authorizeAction.mockResolvedValueOnce({ ok: false, message: "Not authorized" });
    expect(await startInstallmentCheckout(form())).toEqual({ error: "Not authorized" });
    db.rows.transactions = { id: transactionId, customer_id: "other" };
    expect(await startInstallmentCheckout(form())).toEqual({ error: "Transaction not found." });
    expect(db.writes).toEqual([]);
  });

  it("refuses a closed account and a finished transaction", async () => {
    db.rows.installment_accounts = { id: accountId, state: "closed", installments: schedule };
    expect(await startInstallmentCheckout(form())).toHaveProperty("error");
    db.rows.installment_accounts = { id: accountId, state: "active", installments: schedule };
    db.rows.transactions = { id: transactionId, customer_id: buyerId, current_state: "pending" };
    expect(await startInstallmentCheckout(form())).toHaveProperty("error");
    expect(db.writes).toEqual([]);
  });

  it("requires selected unpaid installments belonging to this account", async () => {
    expect(await startInstallmentCheckout(form(true))).toHaveProperty("error");
    expect(await startInstallmentCheckout(form(true, [buyerId]))).toHaveProperty("error");
    db.rows.installment_accounts = {
      id: accountId,
      state: "active",
      installments: [{ ...schedule[0], state: "paid" }],
    };
    expect(await startInstallmentCheckout(form(true, [futureId]))).toHaveProperty("error");
    expect(db.writes).toEqual([]);
  });

  it("rejects repeated ids", async () => {
    expect(await startInstallmentCheckout(form(true, [futureId, futureId]))).toHaveProperty("error");
    expect(db.writes).toEqual([]);
  });

  it("refuses a live payment for a selected installment", async () => {
    db.rows.payment_records = [{ installment_id: firstId, rejected_at: null }];
    expect(await startInstallmentCheckout(form())).toHaveProperty("error", expect.stringContaining("already"));
    expect(db.writes).toEqual([]);
  });

  it("allows a new checkout after the previous payment was rejected", async () => {
    db.rows.payment_records = [{ installment_id: firstId, rejected_at: "2030-01-01" }];
    await expect(startInstallmentCheckout(form())).resolves.toMatchObject({ success: true });
  });

  it("returns PayMongo's error without writing a payment", async () => {
    createCheckoutSession.mockRejectedValue(new Error("cards are down"));
    expect(await startInstallmentCheckout(form())).toHaveProperty("error", expect.stringContaining("cards are down"));
    expect(db.writes).toEqual([]);
  });

  it("reports a duplicate insert from a concurrent request", async () => {
    db.errors.insert = { code: "23505", message: "duplicate" };
    expect(await startInstallmentCheckout(form())).toHaveProperty("error", expect.stringContaining("already"));
  });

  it("reuses an abandoned PayMongo session that is still active", async () => {
    db.rows.payment_records = [
      { installment_id: firstId, paymongo_checkout_id: "cs_old", paid_at: null, rejected_at: null },
    ];
    retrieveCheckoutSession.mockResolvedValue({
      id: "cs_old",
      status: "active",
      checkoutUrl: "https://paymongo.test/cs_old",
      paidPaymentId: null,
    });
    await expect(startInstallmentCheckout(form())).resolves.toEqual({
      success: true,
      url: "https://paymongo.test/cs_old",
    });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("replaces an expired PayMongo session instead of blocking the buyer", async () => {
    db.rows.payment_records = [
      { installment_id: firstId, paymongo_checkout_id: "cs_old", paid_at: null, rejected_at: null },
    ];
    retrieveCheckoutSession.mockResolvedValue({
      id: "cs_old",
      status: "expired",
      checkoutUrl: "https://paymongo.test/cs_old",
      paidPaymentId: null,
    });
    await expect(startInstallmentCheckout(form())).resolves.toMatchObject({ success: true });
    expect(db.writes.some((write) => (write.payload as { op?: string })?.op === "delete")).toBe(true);
    expect(createCheckoutSession).toHaveBeenCalled();
  });
});
