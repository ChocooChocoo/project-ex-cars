import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHmac } from "node:crypto";

const { notify, confirm, db } = vi.hoisted(() => {
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: unknown }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "is"]) builder[step] = () => builder;
    builder.update = (payload: unknown) => {
      writes.push({ table, op: "update", payload });
      return builder;
    };
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return { notify: vi.fn(), confirm: vi.fn(), db: { rows, writes, from } };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/transactions/financing-server", () => ({ confirmInitialDownpaymentIfPaid: confirm }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { POST } from "./route";

const SECRET = "whsk_test_secret";
const buyer = "11111111-1111-4111-8111-111111111111";
const event = (type = "checkout_session.payment.paid") =>
  JSON.stringify({
    data: {
      id: "evt_1",
      attributes: { type, data: { id: "cs_1", attributes: { payments: [{ id: "pay_1" }] } } },
    },
  });

function post(body: string, secret = SECRET) {
  const t = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return POST(
    new Request("https://gce.test/api/paymongo/webhook", {
      method: "POST",
      body,
      headers: { "Paymongo-Signature": `t=${t},te=${signature},li=` },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PAYMONGO_WEBHOOK_SECRET", SECRET);
  db.writes.length = 0;
  db.rows.payment_records = [
    { id: "p1", transaction_id: "tx1", recorded_by: buyer, payment_kind: "delivery_fee", amount: 2500 },
    { id: "p2", transaction_id: "tx1", recorded_by: buyer, payment_kind: "downpayment", amount: 50000 },
  ];
});

describe("PayMongo webhook", () => {
  it("marks the session's rows paid and confirmed, then tells the staff", async () => {
    const response = await post(event());

    expect(response.status).toBe(200);
    expect(db.writes).toEqual([
      {
        table: "payment_records",
        op: "update",
        payload: expect.objectContaining({
          paymongo_payment_id: "pay_1",
          verified_by: buyer,
          paid_at: expect.any(String),
        }),
      },
    ]);
    expect(confirm).toHaveBeenCalledWith(expect.anything(), "tx1");
    expect(notify).toHaveBeenCalledWith(expect.anything(), { role: "head_accountant" }, expect.anything());
  });

  it("changes nothing when the rows are already paid", async () => {
    db.rows.payment_records = [];
    const response = await post(event());

    expect(response.status).toBe(200);
    expect(db.writes).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuses a request PayMongo did not sign", async () => {
    const response = await post(event(), "not-the-secret");

    expect(response.status).toBe(401);
    expect(db.writes).toEqual([]);
  });

  it("acknowledges other events without changing anything", async () => {
    const response = await post(event("payment.failed"));

    expect(response.status).toBe(200);
    expect(db.writes).toEqual([]);
  });
});
