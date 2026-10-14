import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, notify, db } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: every read of a table answers with the row
  // set for it, and every write is recorded.
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: unknown }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "is"]) builder[step] = () => builder;
    for (const op of ["insert", "update", "delete"]) {
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
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ origin: "https://gce.test" })) }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { startOnlinePayment } from "./actions";

const buyerId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const CHECKOUT = "https://checkout.paymongo.com/cs_new";
const fetchMock = vi.fn();
const paymongo = (body: unknown) => new Response(JSON.stringify(body));
const created = () => paymongo({ data: { id: "cs_new", attributes: { checkout_url: CHECKOUT } } });

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

const inserted = () =>
  db.writes.filter((write) => write.table === "payment_records" && write.op === "insert").map((write) => write.payload);

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: buyerId } } });
  vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_x");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => created());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("startOnlinePayment", () => {
  it("opens one Checkout for the delivery fee and the downpayment and records them unpaid", async () => {
    request();

    await expect(pay()).resolves.toEqual({ success: true, url: CHECKOUT });
    const attributes = JSON.parse(fetchMock.mock.calls[0][1].body).data.attributes;
    expect(attributes.line_items.map((line: { amount: number }) => line.amount)).toEqual([250000, 5000000]);
    expect(attributes.success_url).toBe(`https://gce.test/my-transactions/${transactionId}?paid=1`);
    expect(inserted()).toEqual([
      [
        expect.objectContaining({
          payment_kind: "delivery_fee",
          amount: 2500,
          method: "paymongo",
          recorded_by: buyerId,
          paymongo_checkout_id: "cs_new",
        }),
        expect.objectContaining({ payment_kind: "downpayment", amount: 50000, method: "paymongo" }),
      ],
    ]);
  });

  it("sends the buyer back to the open Checkout instead of starting another", async () => {
    const waiting = { method: "paymongo", paymongo_checkout_id: "cs_open", paid_at: null, verified_by: null };
    request({
      payment_records: [
        { ...waiting, payment_kind: "delivery_fee" },
        { ...waiting, payment_kind: "downpayment" },
      ],
    });
    fetchMock.mockImplementation(async () =>
      paymongo({
        data: {
          id: "cs_open",
          attributes: { status: "active", checkout_url: "https://checkout.paymongo.com/cs_open" },
        },
      }),
    );

    await expect(pay()).resolves.toEqual({ success: true, url: "https://checkout.paymongo.com/cs_open" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(inserted()).toEqual([]);
  });

  it("records a Checkout PayMongo already shows paid instead of reopening it", async () => {
    const waiting = { method: "paymongo", paymongo_checkout_id: "cs_paid", paid_at: null, verified_by: null };
    request({
      payment_records: [
        { ...waiting, payment_kind: "delivery_fee" },
        { ...waiting, payment_kind: "downpayment" },
      ],
    });
    fetchMock.mockImplementation(async () =>
      paymongo({
        data: {
          id: "cs_paid",
          attributes: {
            status: "active",
            checkout_url: "u",
            payments: [{ id: "pay_9", attributes: { status: "paid" } }],
          },
        },
      }),
    );

    await expect(pay()).resolves.toEqual({ error: "Your payment is already received. Refresh the page to see it." });
    expect(inserted()).toEqual([]);
  });

  it("replaces an expired Checkout", async () => {
    const waiting = { method: "paymongo", paymongo_checkout_id: "cs_old", paid_at: null, verified_by: null };
    request({
      payment_records: [
        { ...waiting, payment_kind: "delivery_fee" },
        { ...waiting, payment_kind: "downpayment" },
      ],
    });
    fetchMock
      .mockImplementationOnce(async () =>
        paymongo({ data: { id: "cs_old", attributes: { status: "expired", checkout_url: "x" } } }),
      )
      .mockImplementationOnce(async () => created());

    await expect(pay()).resolves.toEqual({ success: true, url: CHECKOUT });
    expect(db.writes).toContainEqual(expect.objectContaining({ table: "payment_records", op: "delete" }));
    expect(inserted()).toEqual([
      [
        expect.objectContaining({ payment_kind: "delivery_fee" }),
        expect.objectContaining({ payment_kind: "downpayment" }),
      ],
    ]);
  });

  it("does not pay again for what is already paid", async () => {
    request({
      payment_records: [
        { payment_kind: "delivery_fee", verified_by: "ha" },
        { payment_kind: "downpayment", verified_by: "ha" },
      ],
    });

    await expect(pay()).resolves.toEqual({ error: "Nothing is left to pay online." });
    expect(fetchMock).not.toHaveBeenCalled();
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

    await expect(pay()).resolves.toEqual({ success: true, url: CHECKOUT });
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

  it("refuses while PayMongo is not set up", async () => {
    vi.stubEnv("PAYMONGO_SECRET_KEY", "");
    request();

    await expect(pay()).resolves.toEqual({ error: "Online payment is not set up yet." });
    expect(inserted()).toEqual([]);
  });
});
