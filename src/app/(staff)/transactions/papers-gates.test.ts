import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, db } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: reads answer with the row (and count) set for
  // the table, writes are recorded.
  const rows: Record<string, unknown> = {};
  const counts: Record<string, number> = {};
  const writes: { table: string; op: string; payload: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, count: counts[table] ?? 0, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "not", "or", "order", "limit"]) builder[step] = () => builder;
    for (const op of ["insert", "upsert", "update"]) {
      builder[op] = (payload: Record<string, unknown>) => {
        writes.push({ table, op, payload });
        return builder;
      };
    }
    builder.maybeSingle = answer;
    builder.single = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return { getUser: vi.fn(), getCurrentRole: vi.fn(), db: { rows, counts, writes, from } };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/auth/audit", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/transactions/buy-flow-server", () => ({
  finalizeBuySale: vi.fn(),
  recordStandingEvent: vi.fn(),
  releaseVisitSlots: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser }, from: db.from })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { advanceDeliveryStatus } from "@/app/(staff)/field-cases/delivery-actions";

import { recordBuyerDecline, recordPayment, transitionTransaction } from "./actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const fieldCaseId = "33333333-3333-4333-8333-333333333333";

const papers = (status: string | null) => {
  db.rows.sale_handovers = status ? { papers_status: status } : null;
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  for (const table of Object.keys(db.counts)) delete db.counts[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: userId } } });
  getCurrentRole.mockResolvedValue("sales_manager");
});

describe("Mark as Sold waits for the vehicle papers", () => {
  function markSold() {
    const fd = new FormData();
    fd.set("id", transactionId);
    fd.set("to_state", "completed");
    return transitionTransaction(fd);
  }

  beforeEach(() => {
    db.rows.transactions = {
      current_state: "approved",
      transaction_kind: "buy",
      vehicle_id: "car-1",
      customer_id: "buyer-1",
      flow_status: null,
      purchase_details: { payment_method: "cash", arrangement_kind: "gce_visit" },
    };
    db.counts.transaction_documents = 2;
    db.counts.payment_records = 1;
  });

  it("refuses before the Confidential Informant has released the papers", async () => {
    papers("requested");

    await expect(markSold()).resolves.toEqual({
      error: "The Confidential Informant must release the vehicle papers before the car is marked sold.",
    });
    expect(db.writes.some((write) => write.table === "transactions")).toBe(false);
  });

  it("marks the car sold once the Sales Manager has received the papers", async () => {
    papers("received");

    await expect(markSold()).resolves.toEqual({ success: true });
  });
});

describe("Mark as Sold waits for the signed contract and its copies", () => {
  const at = "2026-10-14T02:00:00.000Z";

  function markSold() {
    const fd = new FormData();
    fd.set("id", transactionId);
    fd.set("to_state", "completed");
    return transitionTransaction(fd);
  }

  beforeEach(() => {
    db.rows.transactions = {
      current_state: "approved",
      transaction_kind: "buy",
      vehicle_id: "car-1",
      customer_id: "buyer-1",
      flow_status: null,
      purchase_details: { payment_method: "cash", arrangement_kind: "meetup" },
    };
    db.counts.transaction_documents = 2;
    db.counts.payment_records = 1;
  });

  it("refuses an unsigned contract", async () => {
    db.rows.sale_handovers = { papers_status: "handed_over", contract_state: "approved" };

    await expect(markSold()).resolves.toEqual({
      error: "The buyer must sign the contract before the car is marked sold.",
    });
    expect(db.writes.some((write) => write.table === "transactions")).toBe(false);
  });

  it("refuses while the Mechanic has not recorded keeping the signed contract", async () => {
    db.rows.sale_handovers = { papers_status: "handed_over", contract_state: "signed", ci_copy_at: at };

    await expect(markSold()).resolves.toEqual({
      error: "The Mechanic has not recorded keeping the signed contract.",
    });
  });

  it("marks the car sold once the contract is signed and both copies are kept", async () => {
    db.rows.sale_handovers = {
      papers_status: "handed_over",
      contract_state: "signed",
      ci_copy_at: at,
      mechanic_copy_at: at,
    };

    await expect(markSold()).resolves.toEqual({ success: true });
  });
});

describe("a payment waits for the signed contract", () => {
  function pay(kind: string, extra: Record<string, string> = {}) {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    fd.set("amount", "100000");
    fd.set("method", "cash");
    fd.set("settlement_date", "2026-10-14");
    fd.set("payment_kind", kind);
    for (const [key, value] of Object.entries(extra)) fd.set(key, value);
    return recordPayment(fd);
  }

  const request = (method: string, arrangement: string, contractState: string | null) => {
    db.rows.transactions = {
      purchase_details: { payment_method: method, arrangement_kind: arrangement },
      sale_handovers: contractState ? { contract_state: contractState } : null,
    };
  };

  const paid = () => db.writes.some((write) => write.table === "payment_records");
  const REFUSED = { error: "The buyer must sign the contract before a payment is recorded." };

  it("refuses a financing downpayment before the buyer signs", async () => {
    request("financing", "gce_visit", "approved");

    await expect(pay("downpayment")).resolves.toEqual(REFUSED);
    expect(paid()).toBe(false);
  });

  it("refuses the cash at a meet-up before the buyer signs", async () => {
    request("cash", "meetup", null);

    await expect(pay("full")).resolves.toEqual(REFUSED);
  });

  it("records the payment once the contract is signed", async () => {
    request("financing", "gce_visit", "signed");

    await expect(pay("downpayment")).resolves.toEqual({ success: true });
    expect(paid()).toBe(true);
  });

  it("takes a delivery's fee and downpayment before signing, but not its balance", async () => {
    request("cash", "delivery", null);

    await expect(pay("delivery_fee")).resolves.toEqual({ success: true });
    await expect(pay("downpayment")).resolves.toEqual({ success: true });
    await expect(pay("balance")).resolves.toEqual(REFUSED);
  });

  it("asks for no contract on cash at a GCE visit, or on a monthly installment", async () => {
    request("cash", "gce_visit", null);
    await expect(pay("full")).resolves.toEqual({ success: true });

    request("financing", "gce_visit", null);
    await expect(pay("", { installment_id: "44444444-4444-4444-8444-444444444444" })).resolves.toEqual({
      success: true,
    });
  });
});

describe("Mark Dispatched waits for the vehicle papers", () => {
  function dispatch() {
    const fd = new FormData();
    fd.set("field_case_id", fieldCaseId);
    return advanceDeliveryStatus(fd);
  }

  beforeEach(() => {
    getCurrentRole.mockResolvedValue("head_security");
    db.rows.field_cases = {
      id: fieldCaseId,
      transaction_id: transactionId,
      case_kind: "delivery",
      state: "assigned",
      delivery_status: null,
      head_security_id: userId,
    };
    db.rows.transactions = {
      id: transactionId,
      customer_id: "buyer-1",
      current_state: "approved",
      purchase_details: { downpayment_amount: 50000, payment_method: "cash" },
      payment_records: [{ payment_kind: "downpayment", amount: 50000, verified_by: "accountant-1" }],
    };
  });

  it("refuses before the Confidential Informant has recorded the papers as released", async () => {
    papers(null);

    await expect(dispatch()).resolves.toEqual({
      error: "The Confidential Informant must record the vehicle papers as released before dispatch.",
    });
  });

  it("dispatches once the papers are released to the Confidential Informant", async () => {
    papers("released_to_ci");

    await expect(dispatch()).resolves.toEqual({ success: true });
  });
});

describe("a declined purchase", () => {
  it("records the papers back under the Confidential Informant", async () => {
    db.rows.transactions = {
      id: transactionId,
      customer_id: "buyer-1",
      vehicle_id: "car-1",
      current_state: "approved",
      queue_state: null,
      transaction_kind: "buy",
      viewing_arrangements: [
        { schedule: "2033-03-08T02:00:00.000Z", arrangement_kind: "gce_visit", confirmation_state: "confirmed" },
      ],
    };
    const fd = new FormData();
    fd.set("transaction_id", transactionId);

    await expect(recordBuyerDecline(fd)).resolves.toEqual({ success: true });
    expect(db.writes).toContainEqual(
      expect.objectContaining({
        table: "sale_handovers",
        payload: expect.objectContaining({ papers_status: "returned" }),
      }),
    );
  });
});
