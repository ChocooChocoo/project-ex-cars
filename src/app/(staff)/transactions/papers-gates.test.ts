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
    for (const step of ["select", "eq", "neq", "in", "not", "order", "limit"]) builder[step] = () => builder;
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

import { recordBuyerDecline, transitionTransaction } from "./actions";

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
