import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, db, audit } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: reads answer with the row set for the table,
  // writes are recorded, and an insert can be told to fail like the unique index does.
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
  notifyInformantIfPaidInFull: vi.fn(),
  recordStandingEvent: vi.fn(),
  releaseVehicle: vi.fn(),
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

import { notify } from "@/lib/notifications/notify";

import { recordAdvancePayment, recordPayment } from "./actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const firstInstallment = "33333333-3333-4333-8333-333333333333";
const secondInstallment = "44444444-4444-4444-8444-444444444444";

function advance(installmentIds: string[], overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("transaction_id", transactionId);
  for (const installmentId of installmentIds) form.append("installment_ids", installmentId);
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return recordAdvancePayment(form);
}

function installment(amountDue: number, overrides: Record<string, unknown> = {}) {
  return {
    id: firstInstallment,
    amount_due: amountDue,
    state: "upcoming",
    account_id: "account-1",
    installment_accounts: { purchase_transaction_id: transactionId },
    ...overrides,
  };
}

const paymentInserts = () =>
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

describe("recordAdvancePayment (T11)", () => {
  it("records one cash installment payment per ticked installment, at the server's amount", async () => {
    db.rows.installments = installment(25_000);

    await expect(advance([firstInstallment])).resolves.toEqual({ success: true, recorded: 1 });
    expect(paymentInserts()).toEqual([
      expect.objectContaining({
        transaction_id: transactionId,
        installment_id: firstInstallment,
        amount: 25_000,
        method: "cash",
        payment_kind: "installment",
        recorded_by: userId,
        proof_path: null,
      }),
    ]);
  });

  it("tells the Head Accountant once, for the whole advance payment", async () => {
    db.rows.installments = installment(25_000);

    await advance([firstInstallment]);

    expect(notify).toHaveBeenCalledTimes(1);
    const [, to, message] = vi.mocked(notify).mock.calls[0] ?? [];
    expect(to).toEqual({ role: "head_accountant" });
    expect(message).toMatchObject({ kind: "installment_recorded", transactionId });
    expect(message?.body).toContain("₱25,000");
  });

  it("refuses an empty selection", async () => {
    await expect(advance([])).resolves.toEqual({ error: "Pick at least one installment to pay in advance." });
    expect(paymentInserts()).toEqual([]);
  });

  it("refuses an installment that belongs to another transaction", async () => {
    db.rows.installments = installment(25_000, {
      installment_accounts: { purchase_transaction_id: "99999999-9999-4999-8999-999999999999" },
    });

    await expect(advance([firstInstallment])).resolves.toEqual({ error: "Installment not found." });
    expect(paymentInserts()).toEqual([]);
  });

  it("refuses an installment that is already paid or waived", async () => {
    db.rows.installments = installment(25_000, { state: "paid" });

    await expect(advance([firstInstallment])).resolves.toEqual({ error: "This installment is already settled." });
    expect(paymentInserts()).toEqual([]);
  });

  it("turns the live-installment unique violation into the message the Sales Manager reads", async () => {
    db.rows.installments = installment(25_000);
    db.errors.insert = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "idx_payment_records_live_installment"',
    };

    await expect(advance([firstInstallment])).resolves.toEqual({ error: "This installment is already recorded." });
  });

  it.each(["head_accountant", "account_manager"])("refuses the %s role", async (role) => {
    getCurrentRole.mockResolvedValue(role);

    await expect(advance([firstInstallment])).resolves.toEqual({
      error: "The Sales Manager records the advance payment.",
    });
    expect(paymentInserts()).toEqual([]);
  });

  it("refuses an unauthenticated caller", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(advance([firstInstallment])).resolves.toEqual({ error: "Not authenticated" });
  });

  it("stops on the first failing installment and reports its error", async () => {
    db.rows.installments = installment(25_000, { state: "upcoming" });
    db.errors.insert = { message: "permission denied for table payment_records" };

    await expect(advance([firstInstallment, secondInstallment])).resolves.toEqual({
      error: "permission denied for table payment_records",
    });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("recordPayment tells the Head Accountant (T11)", () => {
  function record(overrides: Record<string, string> = {}) {
    const form = new FormData();
    form.set("transaction_id", transactionId);
    form.set("amount", "5000");
    form.set("method", "cash");
    form.set("settlement_date", "2026-11-16");
    form.set("payment_kind", "downpayment");
    for (const [key, value] of Object.entries(overrides)) form.set(key, value);
    return recordPayment(form);
  }

  it("notifies the Head Accountant once a cash payment is on record", async () => {
    db.rows.transactions = {
      flow_status: "purchase_claim",
      purchase_details: { payment_method: "financing", arrangement_kind: "gce_visit", final_price: 600_000 },
      payment_records: [],
      sale_handovers: { contract_state: "signed" },
    };

    await expect(record()).resolves.toEqual({ success: true });
    const [, to, message] = vi.mocked(notify).mock.calls[0] ?? [];
    expect(to).toEqual({ role: "head_accountant" });
    expect(message).toMatchObject({
      kind: "installment_recorded",
      title: "Payment waiting for your confirmation",
      transactionId,
    });
    expect(message?.body).toContain("5,000");
    expect(message?.body).toContain("downpayment");
  });

  it("notifies the Head Accountant for a cash installment too", async () => {
    db.rows.installments = {
      amount_due: 25_000,
      account_id: "account-1",
      installment_accounts: { purchase_transaction_id: transactionId },
    };

    await expect(
      record({ installment_id: firstInstallment, amount: "25000", payment_kind: "", method: "cash" }),
    ).resolves.toEqual({ success: true });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notify).mock.calls[0]?.[1]).toEqual({ role: "head_accountant" });
  });

  // The online-installment exception in the action is unreachable from this path: the payment schema refuses
  // PayMongo outright, and an online installment arrives through the buyer's PayMongo session instead.
  it("refuses an online method on the staff path, so no PayMongo row skips verification", async () => {
    db.rows.installments = {
      amount_due: 25_000,
      account_id: "account-1",
      installment_accounts: { purchase_transaction_id: transactionId },
    };

    await expect(
      record({ installment_id: firstInstallment, amount: "25000", payment_kind: "", method: "paymongo" }),
    ).resolves.toEqual({ error: 'Invalid option: expected one of "cash"|"financing"|"bank_transfer"' });
    expect(notify).not.toHaveBeenCalled();
  });
});
