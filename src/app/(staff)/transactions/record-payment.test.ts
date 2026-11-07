import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, db, audit } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: reads answer with the row set for the table,
  // writes are recorded, and the insert can be told to fail like the unique index does.
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: Record<string, unknown> }[] = [];
  const errors: { insert: { code?: string; message: string } | null } = { insert: null };
  const from = (table: string) => {
    let operation = "read";
    const answer = () =>
      Promise.resolve(
        operation === "insert"
          ? { data: null, error: errors.insert }
          : { data: rows[table] ?? null, count: 0, error: null },
      );
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "is", "not", "or", "order", "limit"])
      builder[step] = () => builder;
    for (const write of ["insert", "update", "upsert"]) {
      builder[write] = (payload: Record<string, unknown>) => {
        operation = write;
        writes.push({ table, op: write, payload });
        return builder;
      };
    }
    builder.single = answer;
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return {
    getUser: vi.fn(),
    getCurrentRole: vi.fn(),
    db: { rows, writes, errors, from },
    audit: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/auth/audit", () => ({ logAuditEvent: audit }));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/transactions/buy-flow-server", () => ({
  finalizeBuySale: vi.fn(),
  recordStandingEvent: vi.fn(),
  releaseVisitSlots: vi.fn(),
}));
vi.mock("@/lib/transactions/financing-server", () => ({
  closeFinancingIfPaid: vi.fn(),
  confirmInitialDownpaymentIfPaid: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser },
    from: db.from,
    storage: { from: vi.fn(() => ({ upload: vi.fn(), remove: vi.fn() })) },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { closeFinancingIfPaid } from "@/lib/transactions/financing-server";

import { markInstallmentWaived, recordPayment, verifyPayment } from "./actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const installmentId = "33333333-3333-4333-8333-333333333333";

function record(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("transaction_id", transactionId);
  form.set("amount", "1");
  form.set("method", "bank_transfer");
  form.set("settlement_date", "2026-10-31");
  form.set("payment_kind", "delivery_fee");
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return recordPayment(form);
}

function sale(overrides: Record<string, unknown> = {}) {
  return {
    flow_status: null,
    purchase_details: { payment_method: "cash", arrangement_kind: "gce_visit", final_price: 600_000 },
    payment_records: [],
    sale_handovers: null,
    ...overrides,
  };
}

const inserts = () =>
  db.writes.filter((write) => write.table === "payment_records" && write.op === "insert").map((write) => write.payload);

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  db.errors.insert = null;
  getUser.mockResolvedValue({ data: { user: { id: userId } } });
  getCurrentRole.mockResolvedValue("sales_manager");
  audit.mockResolvedValue(undefined);
});

describe("Record Payment on a CASH buy (T05)", () => {
  it("records the price the server works out, not the amount and kind the form sent", async () => {
    db.rows.transactions = sale();

    await expect(record()).resolves.toEqual({ success: true });
    expect(inserts()).toEqual([
      expect.objectContaining({ amount: 600_000, method: "cash", payment_kind: "full", recorded_by: userId }),
    ]);
  });

  it("takes a delivery's fee before its downpayment", async () => {
    db.rows.transactions = sale({
      purchase_details: {
        payment_method: "cash",
        arrangement_kind: "delivery",
        final_price: 600_000,
        delivery_fee: 2500,
        downpayment_amount: 60_000,
        downpayment_due_at: "2033-03-01T00:00:00.000Z",
      },
    });

    await expect(record({ amount: "999", payment_kind: "full" })).resolves.toEqual({ success: true });
    expect(inserts()).toEqual([
      expect.objectContaining({ amount: 2500, payment_kind: "delivery_fee", method: "cash" }),
    ]);
  });

  it("never records a second delivery fee once one is on file", async () => {
    db.rows.transactions = sale({
      purchase_details: {
        payment_method: "cash",
        arrangement_kind: "delivery",
        final_price: 600_000,
        delivery_fee: 2500,
        downpayment_amount: 60_000,
        downpayment_due_at: "2033-03-01T00:00:00.000Z",
      },
      payment_records: [{ payment_kind: "delivery_fee", amount: 2500, verified_by: null, rejected_at: null }],
    });

    await expect(record({ payment_kind: "delivery_fee" })).resolves.toEqual({ success: true });
    expect(inserts()).toEqual([
      expect.objectContaining({ amount: 60_000, payment_kind: "downpayment", method: "cash" }),
    ]);
  });

  it("turns the unique violation into the message the Sales Manager reads", async () => {
    db.rows.transactions = sale();
    db.errors.insert = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "idx_payment_records_once_per_kind"',
    };

    await expect(record()).resolves.toEqual({ error: "This payment is already recorded." });
    expect(audit).not.toHaveBeenCalled();
  });

  it("refuses a payment once the price is covered", async () => {
    db.rows.transactions = sale({
      payment_records: [{ payment_kind: "full", amount: 600_000, verified_by: null, rejected_at: null }],
    });

    await expect(record()).resolves.toEqual({ error: "Nothing is due on this purchase." });
    expect(inserts()).toEqual([]);
  });
});

describe("who records a payment (T05)", () => {
  it("refuses a payment recorded by the Head Accountant", async () => {
    getCurrentRole.mockResolvedValue("head_accountant");

    await expect(record()).resolves.toEqual({
      error: "The Sales Manager records the payment. The Head Accountant verifies it.",
    });
    expect(inserts()).toEqual([]);
  });

  it("lets the Sales Manager record a cash installment for the Head Accountant", async () => {
    getCurrentRole.mockResolvedValue("sales_manager");
    db.rows.installments = {
      amount_due: 25_000,
      account_id: "account-1",
      installment_accounts: { purchase_transaction_id: transactionId },
    };

    await expect(
      record({
        installment_id: installmentId,
        amount: "25000",
        method: "cash",
        payment_kind: "",
      }),
    ).resolves.toEqual({ success: true });
    expect(inserts()).toEqual([
      expect.objectContaining({
        installment_id: installmentId,
        amount: 25_000,
        method: "cash",
        payment_kind: "installment",
      }),
    ]);
    expect(db.writes.some((write) => write.table === "installments")).toBe(false);
    expect(closeFinancingIfPaid).not.toHaveBeenCalled();
  });

  it("refuses an installment recorded by the Head Accountant", async () => {
    getCurrentRole.mockResolvedValue("head_accountant");

    await expect(
      record({
        installment_id: installmentId,
        amount: "25000",
        method: "cash",
        payment_kind: "",
      }),
    ).resolves.toEqual({ error: "The Sales Manager records the installment. The Head Accountant verifies it." });
    expect(inserts()).toEqual([]);
  });

  it("still records a financing payment for the Sales Manager", async () => {
    db.rows.transactions = sale({
      purchase_details: { payment_method: "financing", arrangement_kind: "gce_visit", final_price: 600_000 },
      sale_handovers: { contract_state: "signed" },
    });

    await expect(record({ amount: "5000", method: "cash", payment_kind: "downpayment" })).resolves.toEqual({
      success: true,
    });
    expect(inserts()).toEqual([expect.objectContaining({ amount: 5000, method: "cash", payment_kind: "downpayment" })]);
  });
});

describe("verify financing installment", () => {
  it("checks financing closure after waiving the last unpaid installment", async () => {
    getCurrentRole.mockResolvedValue("head_accountant");
    db.rows.installments = { account_id: "account-1" };
    db.rows.installment_accounts = { purchase_transaction_id: transactionId };
    expect(await markInstallmentWaived(installmentId)).toEqual({ success: true });
    expect(closeFinancingIfPaid).toHaveBeenCalledWith(expect.anything(), transactionId);
  });

  it("marks the linked installment paid on settlement date and checks account closure", async () => {
    getCurrentRole.mockResolvedValue("head_accountant");
    db.rows.payment_records = {
      transaction_id: transactionId,
      installment_id: installmentId,
      settlement_date: "2026-11-05",
      amount: 5000,
    };
    db.rows.installments = { amount_due: 5000 };
    expect(await verifyPayment("payment-1")).toEqual({ success: true });
    expect(db.writes).toContainEqual({
      table: "installments",
      op: "update",
      payload: { state: "paid", payment_date: "2026-11-05" },
    });
    expect(closeFinancingIfPaid).toHaveBeenCalledWith(expect.anything(), transactionId);
  });

  it("refuses an online installment the Sales Manager has not approved", async () => {
    getCurrentRole.mockResolvedValue("head_accountant");
    db.rows.payment_records = {
      transaction_id: transactionId,
      installment_id: installmentId,
      method: "paymongo",
      payment_kind: "installment",
      approved_at: null,
    };
    expect(await verifyPayment("payment-1")).toEqual({
      error: "The Sales Manager must approve this online payment first.",
    });
    expect(db.writes.some((write) => write.table === "installments")).toBe(false);
  });

  it("does not mark installments when no unrejected payment was updated", async () => {
    getCurrentRole.mockResolvedValue("head_accountant");
    db.rows.payment_records = null;
    await verifyPayment("payment-1");
    expect(db.writes.some((write) => write.table === "installments")).toBe(false);
  });
});
