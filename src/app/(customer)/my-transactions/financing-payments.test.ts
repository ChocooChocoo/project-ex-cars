import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, upload, remove, authorizeAction } = vi.hoisted(() => {
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
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: Supabase queries are awaitable.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return { db: { rows, writes, errors, from }, upload: vi.fn(), remove: vi.fn(), authorizeAction: vi.fn() };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/action-guard", () => ({ authorizeAction }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: buyerId } } }) },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: db.from, storage: { from: () => ({ upload, remove }) } })),
}));

import { submitAdvancedPayment, submitFinancingPayment } from "./actions";

const buyerId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const accountId = "33333333-3333-4333-8333-333333333333";
const firstId = "44444444-4444-4444-8444-444444444444";
const futureId = "55555555-5555-4555-8555-555555555555";
const schedule = [
  { id: futureId, account_id: accountId, state: "upcoming", due_date: "2030-02-15", amount_due: 1500 },
  { id: firstId, account_id: accountId, state: "due", due_date: "2030-01-15", amount_due: 1500 },
];

function form(method = "cash", ids: string[] = []) {
  const fd = new FormData();
  fd.set("transaction_id", transactionId);
  fd.set("method", method);
  fd.set("amount", "1");
  for (const id of ids) fd.append("installment_ids", id);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.writes.length = 0;
  db.errors.insert = null;
  authorizeAction.mockResolvedValue({ ok: true });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  db.rows.transactions = { id: transactionId, customer_id: buyerId, current_state: "approved" };
  db.rows.installment_accounts = { id: accountId, state: "active", installments: schedule };
  db.rows.payment_records = [];
});

describe("customer financing payments", () => {
  it("submits the next unpaid installment's exact amount, pending accountant verification", async () => {
    await expect(submitFinancingPayment(form())).resolves.toEqual({ success: true });
    expect(authorizeAction).toHaveBeenCalledWith(["customer"]);
    expect(db.writes).toEqual([
      {
        table: "payment_records",
        payload: [
          expect.objectContaining({
            installment_id: firstId,
            amount: 1500,
            method: "cash",
            payment_kind: "installment",
            submitted_by: buyerId,
            verified_by: null,
          }),
        ],
      },
    ]);
  });

  it("submits one row per selected installment with no partial allocation", async () => {
    await expect(submitAdvancedPayment(form("cash", [futureId, firstId]))).resolves.toEqual({ success: true });
    expect((db.writes[0].payload as { amount: number }[]).map((row) => row.amount)).toEqual([1500, 1500]);
  });

  it("requires a customer and ownership", async () => {
    authorizeAction.mockResolvedValueOnce({ ok: false, message: "Not authorized" });
    expect(await submitFinancingPayment(form())).toEqual({ error: "Not authorized" });
    db.rows.transactions = { id: transactionId, customer_id: "other" };
    expect(await submitFinancingPayment(form())).toEqual({ error: "Transaction not found." });
    expect(db.writes).toEqual([]);
  });

  it("refuses a closed account", async () => {
    db.rows.installment_accounts = { id: accountId, state: "closed", installments: schedule };
    expect(await submitFinancingPayment(form())).toHaveProperty("error");
    expect(db.writes).toEqual([]);
  });

  it("requires selected unpaid installments belonging to this account", async () => {
    expect(await submitAdvancedPayment(form())).toHaveProperty("error");
    expect(await submitAdvancedPayment(form("cash", [buyerId]))).toHaveProperty("error");
    db.rows.installment_accounts = {
      id: accountId,
      state: "active",
      installments: [{ ...schedule[0], state: "paid" }],
    };
    expect(await submitAdvancedPayment(form("cash", [futureId]))).toHaveProperty("error");
    expect(db.writes).toEqual([]);
  });

  it("rejects repeated ids and unsupported payment methods", async () => {
    expect(await submitAdvancedPayment(form("cash", [futureId, futureId]))).toHaveProperty("error");
    expect(await submitFinancingPayment(form("financing"))).toHaveProperty("error");
    expect(db.writes).toEqual([]);
  });

  it.each([null, buyerId])("refuses pending or verified live payment (%s)", async (verified_by) => {
    db.rows.payment_records = [{ installment_id: firstId, rejected_at: null, verified_by }];
    expect(await submitFinancingPayment(form())).toHaveProperty("error", expect.stringContaining("already"));
    expect(db.writes).toEqual([]);
  });

  it("allows resubmission after rejection", async () => {
    db.rows.payment_records = [{ installment_id: firstId, rejected_at: "2030-01-01" }];
    expect(await submitFinancingPayment(form())).toEqual({ success: true });
  });

  it("requires a transfer proof, accepts optional cash proof, and stores the path", async () => {
    expect(await submitFinancingPayment(form("bank_transfer"))).toHaveProperty(
      "error",
      expect.stringContaining("proof"),
    );
    const fd = form("bank_transfer");
    fd.set("proof", new File(["photo"], "slip.png", { type: "image/png" }));
    expect(await submitFinancingPayment(fd)).toEqual({ success: true });
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${transactionId}/payment-proof-`)),
      expect.any(File),
    );
    expect(db.writes[0].payload).toEqual([
      expect.objectContaining({ proof_path: expect.stringContaining("payment-proof-") }),
    ]);
  });

  it("rejects invalid proof and cleans up an upload when insertion fails", async () => {
    const fd = form("cash");
    fd.set("proof", new File(["bad"], "file.html", { type: "text/html" }));
    expect(await submitFinancingPayment(fd)).toHaveProperty("error");
    expect(upload).not.toHaveBeenCalled();
    fd.set("proof", new File(["photo"], "slip.png", { type: "image/png" }));
    db.errors.insert = { code: "23505", message: "duplicate" };
    expect(await submitFinancingPayment(fd)).toHaveProperty("error", expect.stringContaining("already"));
    expect(remove).toHaveBeenCalled();
  });
});
