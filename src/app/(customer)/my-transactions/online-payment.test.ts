import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, notify, db } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: every read of a table answers with the row
  // set for it, and every write is recorded.
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: unknown }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in"]) builder[step] = () => builder;
    for (const op of ["insert", "update"]) {
      builder[op] = (payload: unknown) => {
        writes.push({ table, op, payload });
        return builder;
      };
    }
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return { getUser: vi.fn(), notify: vi.fn(), db: { rows, writes, from } };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { startOnlinePayment } from "./actions";

const buyerId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const LINK = "https://paymongo.page/l/gce-test";

function pay() {
  const fd = new FormData();
  fd.set("transaction_id", transactionId);
  return startOnlinePayment(fd);
}

function request(overrides: Record<string, unknown> = {}) {
  db.rows.transactions = {
    id: transactionId,
    customer_id: buyerId,
    current_state: "approved",
    flow_status: null,
    purchase_details: {
      payment_method: "cash",
      arrangement_kind: "delivery",
      delivery_fee: 2500,
      downpayment_amount: 50000,
      downpayment_due_at: "2033-03-01T00:00:00.000Z",
    },
    payment_records: [],
    payment_terms: null,
    sale_handovers: null,
    ...overrides,
  };
}

const inserted = () => db.writes.filter((write) => write.table === "payment_records").map((write) => write.payload);

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: buyerId } } });
  vi.stubEnv("NEXT_PUBLIC_PAYMONGO_LINK", LINK);
});

afterEach(() => vi.unstubAllEnvs());

describe("startOnlinePayment", () => {
  it("records the delivery fee and the downpayment unverified and sends the buyer to the link", async () => {
    request();

    await expect(pay()).resolves.toEqual({ success: true, url: LINK });
    expect(inserted()).toEqual([
      [
        expect.objectContaining({
          payment_kind: "delivery_fee",
          amount: 2500,
          method: "paymongo",
          recorded_by: buyerId,
        }),
        expect.objectContaining({ payment_kind: "downpayment", amount: 50000, method: "paymongo" }),
      ],
    ]);
    expect(notify).toHaveBeenCalledWith(expect.anything(), { role: "head_accountant" }, expect.anything());
  });

  it("does not record a second row for what is already paid or sent", async () => {
    request({ payment_records: [{ payment_kind: "delivery_fee" }, { payment_kind: "downpayment" }] });

    await expect(pay()).resolves.toEqual({ success: true, url: LINK });
    expect(inserted()).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuses the financing downpayment at a GCE visit before the buyer signs", async () => {
    request({
      flow_status: "purchase_claim",
      purchase_details: { payment_method: "financing", arrangement_kind: "gce_visit" },
      payment_terms: { down_payment: 100000, state: "approved" },
      sale_handovers: { contract_state: "approved" },
    });

    await expect(pay()).resolves.toEqual({ error: "Sign the contract before paying." });
    expect(inserted()).toEqual([]);
  });

  it("takes the financing downpayment once the contract is signed, and waits for the Head Accountant", async () => {
    request({
      flow_status: "purchase_claim",
      purchase_details: { payment_method: "financing", arrangement_kind: "gce_visit" },
      payment_terms: { down_payment: 100000, state: "approved" },
      sale_handovers: { contract_state: "signed" },
    });

    await expect(pay()).resolves.toEqual({ success: true, url: LINK });
    expect(inserted()).toEqual([[expect.objectContaining({ payment_kind: "downpayment", amount: 100000 })]]);
    expect(db.writes).toContainEqual(
      expect.objectContaining({ table: "transactions", payload: { flow_status: "initial_dp_awaiting_verification" } }),
    );
  });

  it("refuses when nothing is due online", async () => {
    request({ purchase_details: { payment_method: "cash", arrangement_kind: "gce_visit" } });

    await expect(pay()).resolves.toEqual({ error: "Nothing is due online right now." });
  });

  it("refuses another buyer's request", async () => {
    request({ customer_id: "someone-else" });

    await expect(pay()).resolves.toEqual({ error: "Transaction not found." });
    expect(inserted()).toEqual([]);
  });

  it("refuses while no payment link is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMONGO_LINK", "");
    request();

    await expect(pay()).resolves.toEqual({ error: "Online payment is not set up yet." });
    expect(inserted()).toEqual([]);
  });
});
