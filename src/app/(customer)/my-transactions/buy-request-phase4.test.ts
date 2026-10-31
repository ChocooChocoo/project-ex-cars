import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, notify, db } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: every read of a table answers with the row
  // (and count) set for it, and every write is recorded.
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: Record<string, unknown> }[] = [];
  const insertErrors: Record<string, { code: string; message: string }> = {};
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, count: 0, error: insertErrors[table] ?? null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "order", "limit"]) builder[step] = () => builder;
    for (const op of ["insert", "upsert", "update"]) {
      builder[op] = (payload: Record<string, unknown>) => {
        writes.push({ table, op, payload });
        return builder;
      };
    }
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return { getUser: vi.fn(), notify: vi.fn(), db: { rows, writes, from, insertErrors } };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/transactions/buy-flow-server", () => ({ releaseVisitSlots: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser }, from: db.from })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { saveBuyDetails, submitBuyRequest } from "./actions";

const buyerId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
// Tuesday 8 March 2033, 10:00 AM in Manila.
const slot = "2033-03-08T02:00:00.000Z";

function details(fields: Record<string, string>) {
  const fd = new FormData();
  fd.set("transaction_id", transactionId);
  fd.set("acknowledge_condition", "yes");
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const saved = () => db.writes.find((write) => write.table === "purchase_details")?.payload;

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  for (const table of Object.keys(db.insertErrors)) delete db.insertErrors[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: buyerId } } });
});

describe("saveBuyDetails", () => {
  beforeEach(() => {
    db.rows.transactions = {
      id: transactionId,
      customer_id: buyerId,
      transaction_kind: "buy",
      current_state: "pending",
      queue_state: null,
      vehicles: { current_price: 500000 },
    };
  });

  const delivery = { payment_method: "cash", arrangement_kind: "delivery", schedule: slot, location: "12 Mabini St" };

  it("refuses a delivery until the buyer agrees to the delivery terms", async () => {
    await expect(saveBuyDetails(details(delivery))).resolves.toEqual({
      error: "Read the delivery terms and tick I agree.",
    });
    expect(saved()).toBeUndefined();
  });

  it("records when the buyer agreed to the delivery terms", async () => {
    await expect(saveBuyDetails(details({ ...delivery, agree_delivery_terms: "yes" }))).resolves.toEqual({
      success: true,
    });
    expect(saved()).toMatchObject({ delivery_terms_agreed_at: expect.any(String) });
  });

  it("asks a financed meet-up for the payment term", async () => {
    const meetup = { payment_method: "financing", arrangement_kind: "meetup" };

    await expect(saveBuyDetails(details(meetup))).resolves.toEqual({ error: "Choose a payment term." });

    await expect(saveBuyDetails(details({ ...meetup, requested_term_months: "36" }))).resolves.toEqual({
      success: true,
    });
    expect(saved()).toMatchObject({ requested_term_months: 36 });
  });

  // T04 P5–P7: Payment Option and every financing term.
  it("asks every financing arrangement for a term and offers 6 months", async () => {
    const visit = { payment_option: "financing", payment_method: "cash", arrangement_kind: "gce_visit" };

    await expect(saveBuyDetails(details(visit))).resolves.toEqual({ error: "Choose a payment term." });
    await expect(saveBuyDetails(details({ ...visit, requested_term_months: "48" }))).resolves.toEqual({
      error: "Choose a payment term.",
    });

    await expect(saveBuyDetails(details({ ...visit, requested_term_months: "6" }))).resolves.toEqual({
      success: true,
    });
    expect(saved()).toMatchObject({
      payment_option: "financing",
      payment_method: "financing",
      requested_term_months: 6,
    });
  });

  it("saves Bank Transfer as the Full Payment method", async () => {
    await expect(
      saveBuyDetails(
        details({ payment_option: "full", payment_method: "bank_transfer", arrangement_kind: "gce_visit" }),
      ),
    ).resolves.toEqual({ success: true });
    expect(saved()).toMatchObject({ payment_option: "full", payment_method: "bank_transfer" });
  });

  it("no longer accepts PayMongo as a payment method", async () => {
    await expect(
      saveBuyDetails(details({ payment_option: "full", payment_method: "paymongo", arrangement_kind: "gce_visit" })),
    ).resolves.toEqual({ error: "Select a payment method." });
    expect(saved()).toBeUndefined();
  });

  it("refuses Full Payment with the financing method", async () => {
    await expect(
      saveBuyDetails(details({ payment_option: "full", payment_method: "financing", arrangement_kind: "gce_visit" })),
    ).resolves.toEqual({ error: "Select a payment method." });
    expect(saved()).toBeUndefined();
  });

  it("saves no location for a GCE Visit", async () => {
    await expect(
      saveBuyDetails(
        details({
          payment_option: "full",
          payment_method: "cash",
          arrangement_kind: "gce_visit",
          schedule: slot,
          location: "12 Mabini St",
        }),
      ),
    ).resolves.toEqual({ success: true });
    const arrangement = db.writes.find((write) => write.table === "viewing_arrangements")?.payload;
    expect(arrangement).toMatchObject({ arrangement_kind: "gce_visit", location: null });
  });

  it("takes the new slot before releasing the buyer's old one", async () => {
    db.rows.viewing_arrangements = [{ id: "old-slot", schedule: "2033-03-01T02:00:00.000Z" }];

    await expect(saveBuyDetails(details({ ...delivery, agree_delivery_terms: "yes" }))).resolves.toEqual({
      success: true,
    });

    expect(db.writes.filter((write) => write.table === "viewing_arrangements").map((write) => write.op)).toEqual([
      "insert",
      "update",
    ]);
  });

  it("keeps the buyer's old slot when the new time is already taken (23505)", async () => {
    db.rows.viewing_arrangements = [{ id: "old-slot", schedule: "2033-03-01T02:00:00.000Z" }];
    db.insertErrors.viewing_arrangements = { code: "23505", message: "duplicate key value" };

    await expect(saveBuyDetails(details({ ...delivery, agree_delivery_terms: "yes" }))).resolves.toEqual({
      error: "That visit slot is already taken. Choose another time.",
    });

    expect(db.writes.filter((write) => write.table === "viewing_arrangements" && write.op === "update")).toEqual([]);
  });

  it("refreshes the buyer's own booking when they re-pick the same time", async () => {
    db.rows.viewing_arrangements = [{ id: "own-slot", schedule: slot }];

    await expect(saveBuyDetails(details({ ...delivery, agree_delivery_terms: "yes" }))).resolves.toEqual({
      success: true,
    });

    expect(db.writes.filter((write) => write.table === "viewing_arrangements").map((write) => write.op)).toEqual([
      "update",
    ]);
  });
});

describe("submitBuyRequest", () => {
  const request = (arrangement: string, extra: Record<string, unknown> = {}) => {
    db.rows.transactions = {
      id: transactionId,
      customer_id: buyerId,
      vehicle_id: "car-1",
      transaction_kind: "buy",
      current_state: "pending",
      queue_state: null,
      purchase_details: {
        payment_method: "financing",
        arrangement_kind: arrangement,
        condition_acknowledged_at: "2033-01-01T00:00:00.000Z",
        ...extra,
      },
    };
    db.rows.transaction_documents = [
      { document_kind: "valid_id", verification_state: "pending" },
      { document_kind: "valid_id", verification_state: "pending" },
    ];
  };
  const form = () => {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    return fd;
  };

  it("needs the delivery date of a financed delivery at request", async () => {
    request("delivery", { delivery_terms_agreed_at: "2033-01-01T00:00:00.000Z" });

    await expect(submitBuyRequest(form())).resolves.toEqual({ error: "Book the meeting time first." });
  });

  it("does not send a delivery the buyer has not agreed the terms of", async () => {
    request("delivery");
    db.rows.viewing_arrangements = { schedule: slot, arrangement_kind: "delivery" };

    await expect(submitBuyRequest(form())).resolves.toEqual({ error: "Agree to the delivery terms first." });
    expect(db.writes.some((write) => write.table === "transactions")).toBe(false);
  });

  it("opens a chat thread with GCE on a financing request", async () => {
    request("gce_visit");

    await expect(submitBuyRequest(form())).resolves.toMatchObject({ success: true });
    expect(db.writes).toContainEqual({
      table: "inquiries",
      op: "insert",
      payload: {
        customer_id: buyerId,
        vehicle_id: "car-1",
        intention_kind: "buy_financing",
        transaction_id: transactionId,
      },
    });
  });

  it("tells the Sales Manager the booked visit in Manila time, not UTC", async () => {
    db.rows.transactions = {
      id: transactionId,
      customer_id: buyerId,
      vehicle_id: "car-1",
      transaction_kind: "buy",
      current_state: "pending",
      queue_state: null,
      purchase_details: { payment_method: "cash", arrangement_kind: "gce_visit" },
    };
    db.rows.transaction_documents = [
      { document_kind: "valid_id", verification_state: "pending" },
      { document_kind: "valid_id", verification_state: "pending" },
    ];
    db.rows.viewing_arrangements = { schedule: "2033-03-08T02:00:00.000Z", arrangement_kind: "gce_visit" };

    await expect(submitBuyRequest(form())).resolves.toMatchObject({ success: true });

    const bodies = notify.mock.calls.map((call) => (call[2] as { body: string }).body).join(" ");
    expect(bodies).toContain("3/8/2033, 10:00:00 AM");
  });
});
