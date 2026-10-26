import { beforeEach, describe, expect, it, vi } from "vitest";

const { authGetUser, getCurrentRole, notify, logAuditEvent, from, calls } = vi.hoisted(() => {
  const calls: { table: string; op: string; payload?: unknown; filters: [string, unknown][] }[] = [];
  return {
    authGetUser: vi.fn(),
    getCurrentRole: vi.fn(),
    notify: vi.fn(),
    logAuditEvent: vi.fn(),
    calls,
    from: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/auth/audit", () => ({ logAuditEvent }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: authGetUser } })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from })) }));

import { installmentStateFor } from "@/lib/transactions/buy-flow";

import { rejectPayment } from "./payment-review-actions";

const userId = "11111111-1111-4111-8111-111111111111";
const paymentId = "44444444-4444-4444-8444-444444444444";
const transactionId = "22222222-2222-4222-8222-222222222222";
const installmentId = "55555555-5555-4555-8555-555555555555";

// A tiny query builder: records every call and resolves selects from `rows`.
function builder(table: string, rows: Record<string, unknown>) {
  const entry: { table: string; op: string; payload?: unknown; filters: [string, unknown][] } = {
    table,
    op: "select",
    filters: [],
  };
  calls.push(entry);
  const chain: Record<string, unknown> = {
    select: () => chain,
    update: (payload: unknown) => {
      entry.op = "update";
      entry.payload = payload;
      return chain;
    },
    eq: (column: string, value: unknown) => {
      entry.filters.push([column, value]);
      return chain;
    },
    is: (column: string, value: unknown) => {
      entry.filters.push([column, value]);
      return chain;
    },
    maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
    // biome-ignore lint/suspicious/noThenProperty: mimics the awaitable Supabase query builder
    then: (resolve: (value: unknown) => void) => resolve({ data: null, error: null }),
  };
  return chain;
}

function useRows(rows: Record<string, unknown>) {
  from.mockImplementation((table: string) => builder(table, rows));
}

const pending = {
  id: paymentId,
  transaction_id: transactionId,
  installment_id: null,
  payment_kind: "balance",
  amount: 20000,
  verified_by: null,
  rejected_at: null,
  transactions: { customer_id: "cust-1" },
};

describe("rejectPayment (T03 HA3)", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
    authGetUser.mockResolvedValue({ data: { user: { id: userId } } });
    getCurrentRole.mockResolvedValue("head_accountant");
  });

  it("refuses roles that do not verify payments", async () => {
    getCurrentRole.mockResolvedValue("sales_manager");
    await expect(rejectPayment(paymentId, "Blurry photo")).resolves.toEqual({ error: "Not authorized" });
  });

  it("needs a reason", async () => {
    useRows({ payment_records: pending });
    await expect(rejectPayment(paymentId, "  ")).resolves.toEqual({ error: "Give a reason for rejecting." });
  });

  it("refuses a payment that is already verified or rejected", async () => {
    useRows({ payment_records: { ...pending, verified_by: userId } });
    await expect(rejectPayment(paymentId, "Wrong amount")).resolves.toEqual({
      error: "Only a payment waiting for verification can be rejected.",
    });
  });

  it("marks the payment rejected with the reason and tells the buyer", async () => {
    useRows({ payment_records: pending });
    await expect(rejectPayment(paymentId, "Cheque photo does not match the amount")).resolves.toEqual({
      success: true,
    });

    const update = calls.find((c) => c.table === "payment_records" && c.op === "update");
    expect(update?.payload).toMatchObject({
      rejected_by: userId,
      rejection_reason: "Cheque photo does not match the amount",
    });
    expect(update?.filters).toContainEqual(["verified_by", null]);
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      { userId: "cust-1" },
      expect.objectContaining({ transactionId, body: expect.stringContaining("Cheque photo does not match") }),
    );
  });

  it("reopens the installment a rejected payment had marked paid, by its due date", async () => {
    useRows({
      payment_records: { ...pending, installment_id: installmentId },
      installments: { due_date: "2020-01-15" },
    });
    await rejectPayment(paymentId, "Bounced cheque");

    const installment = calls.find((c) => c.table === "installments" && c.op === "update");
    expect(installment?.payload).toEqual({ state: "overdue", payment_date: null });
    expect(installment?.filters).toContainEqual(["id", installmentId]);
  });
});

describe("installmentStateFor", () => {
  it("is overdue before today, due today, upcoming after", () => {
    expect(installmentStateFor("2026-10-25", "2026-10-26")).toBe("overdue");
    expect(installmentStateFor("2026-10-26", "2026-10-26")).toBe("due");
    expect(installmentStateFor("2026-10-27", "2026-10-26")).toBe("upcoming");
  });
});
