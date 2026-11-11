import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, db, notify, storageUpload, storageRemove } = vi.hoisted(() => {
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, count: 0, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "not", "or", "order", "limit"]) builder[step] = () => builder;
    for (const op of ["insert", "upsert", "update"]) {
      builder[op] = (payload: Record<string, unknown>) => {
        writes.push({ table, op, payload });
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
    db: { rows, writes, from },
    notify: vi.fn(),
    storageUpload: vi.fn(),
    storageRemove: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/auth/audit", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/transactions/buy-flow-server", () => ({
  finalizeBuySale: vi.fn(),
  notifyInformantIfPaidInFull: vi.fn(),
  recordStandingEvent: vi.fn(),
  releaseVehicle: vi.fn(),
  releaseVisitSlots: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser },
    from: db.from,
    storage: { from: vi.fn(() => ({ upload: storageUpload, remove: storageRemove })) },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { recordBuyerDecline, recordPaperwork, transitionTransaction } from "./actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";

function buyRow(state: string, paymentMethod = "cash", arrangement = "gce_visit") {
  return {
    current_state: state,
    transaction_kind: "buy",
    vehicle_id: "car-1",
    customer_id: "buyer-1",
    flow_status: null,
    purchase_details: { payment_method: paymentMethod, arrangement_kind: arrangement },
    viewing_arrangements: [
      { schedule: "2033-03-08T02:00:00.000Z", arrangement_kind: arrangement, confirmation_state: "confirmed" },
    ],
  };
}

function transition(to: string) {
  const form = new FormData();
  form.set("id", transactionId);
  form.set("to_state", to);
  return transitionTransaction(form);
}

function decline() {
  const form = new FormData();
  form.set("transaction_id", transactionId);
  return recordBuyerDecline(form);
}

function paperwork(documentKind: string) {
  const form = new FormData();
  form.set("transaction_id", transactionId);
  form.set("document_kind", documentKind);
  form.set("file", new File(["contents"], `${documentKind}.jpg`, { type: "image/jpeg" }));
  return recordPaperwork(form);
}

const updates = (table: string) => db.writes.filter((write) => write.table === table && write.op === "update");

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  getCurrentRole.mockResolvedValue("sales_manager");
  notify.mockResolvedValue(undefined);
  storageUpload.mockResolvedValue({ error: null });
  storageRemove.mockResolvedValue({ error: null });
});

describe("a CASH buy loses Cancel for the Sales Manager", () => {
  it.each(["pending", "approved"])("refuses on the server in %s", async (state) => {
    db.rows.transactions = buyRow(state);

    await expect(transition("cancelled")).resolves.toEqual({
      error: "This action is not allowed for your role.",
    });
    expect(updates("transactions")).toHaveLength(0);
  });

  it("refuses Cancel on a financing buy", async () => {
    db.rows.transactions = buyRow("approved", "financing");

    await expect(transition("cancelled")).resolves.toEqual({ error: "This action is not allowed for your role." });
    expect(updates("transactions")).toHaveLength(0);
  });

  it("keeps the CEO's override on a cash buy", async () => {
    getCurrentRole.mockResolvedValue("ceo");
    db.rows.transactions = buyRow("pending");

    await expect(transition("cancelled")).resolves.toEqual({ success: true });
  });
});

describe("a CASH buy loses the buyer-declined outcomes once the papers are requested", () => {
  it("refuses a decline while the papers are with the Confidential Informant", async () => {
    db.rows.transactions = buyRow("approved");
    db.rows.sale_handovers = { papers_status: "requested" };

    await expect(decline()).resolves.toEqual({
      error: "The vehicle papers were already requested, so the buyer can no longer be recorded as declining.",
    });
    expect(updates("transactions")).toHaveLength(0);
  });

  it("still records a decline before the papers are requested", async () => {
    db.rows.transactions = buyRow("approved");
    db.rows.sale_handovers = null;

    await expect(decline()).resolves.toEqual({ success: true });
  });

  it("allows the decline again once the papers are returned", async () => {
    db.rows.transactions = buyRow("approved");
    db.rows.sale_handovers = { papers_status: "returned" };

    await expect(decline()).resolves.toEqual({ success: true });
  });

  it("keeps a financing decline", async () => {
    db.rows.transactions = buyRow("approved", "financing");
    db.rows.sale_handovers = { papers_status: "requested" };

    await expect(decline()).resolves.toEqual({ success: true });
  });
});

describe("the Sales Manager cannot add a buyer's documents", () => {
  beforeEach(() => {
    db.rows.transactions = { id: transactionId, transaction_kind: "buy" };
  });

  it.each(["valid_id", "proof_of_billing"])("refuses %s", async (documentKind) => {
    await expect(paperwork(documentKind)).resolves.toEqual({
      error: "The buyer uploads the valid ID and proof of billing. Staff verify them.",
    });
    expect(storageUpload).not.toHaveBeenCalled();
    expect(db.writes.some((write) => write.table === "transaction_documents")).toBe(false);
  });

  it("still records an invoice", async () => {
    await expect(paperwork("invoice")).resolves.toEqual({ success: true });
  });

  it("refuses the Head Accountant's upload too", async () => {
    getCurrentRole.mockResolvedValue("head_accountant");

    await expect(paperwork("proof_of_billing")).resolves.toHaveProperty("error");
  });
});
