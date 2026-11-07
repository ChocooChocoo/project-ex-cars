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
    builder.single = answer;
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
  createServerSupabase: vi.fn(async () => ({
    auth: { getUser },
    rpc: vi.fn(async () => ({ data: [{ account_id: buyerId, role: "customer" }], error: null })),
  })),
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser }, from: db.from })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { cancelTransaction, saveBuyDetails, submitBuyRequest } from "./actions";
import { submitReview } from "./review-actions";

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

describe("T07 cancellation and reviews", () => {
  function transaction(current_state = "approved") {
    db.rows.transactions = {
      id: transactionId,
      customer_id: buyerId,
      vehicle_id: "car-1",
      current_state,
      purchase_details: { payment_method: "financing" },
      payment_terms: { state: "active" },
    };
  }
  function cancellation(consent = false) {
    const fd = new FormData();
    fd.set("id", transactionId);
    if (consent) fd.set("towing_ack", "yes");
    return fd;
  }
  it("requires towing consent for active financing", async () => {
    transaction();
    await expect(cancelTransaction(cancellation())).resolves.toMatchObject({ error: expect.stringContaining("Agree") });
    expect(db.writes).toHaveLength(0);
  });
  it("creates recovery, records consent and alerts all three roles after delivery", async () => {
    transaction();
    db.rows.viewing_arrangements = [{ schedule: "2020-01-01T00:00:00Z" }];
    await expect(cancelTransaction(cancellation(true))).resolves.toMatchObject({ success: true });
    expect(saved()).toMatchObject({
      cancellation_towing_ack_by: buyerId,
      cancellation_towing_ack_at: expect.any(String),
    });
    // T07 CR1: cancelling opens the case but never repossesses the car by itself.
    expect(db.writes.some((write) => write.table === "vehicles")).toBe(false);
    expect(db.writes).toContainEqual(
      expect.objectContaining({
        table: "field_cases",
        op: "insert",
        payload: expect.objectContaining({ transaction_id: transactionId, case_kind: "recovery", state: "assigned" }),
      }),
    );
    for (const role of ["head_accountant", "confidential_informant", "head_security"]) {
      expect(notify).toHaveBeenCalledWith(
        expect.anything(),
        { role },
        expect.objectContaining({ kind: "financing_cancelled_recovery" }),
      );
    }
  });
  it("does not duplicate an open recovery", async () => {
    transaction();
    db.rows.field_cases = { id: "existing" };
    await cancelTransaction(cancellation(true));
    expect(db.writes.filter((write) => write.table === "field_cases" && write.op === "insert")).toHaveLength(0);
  });
  it("requires consent after financed delivery even before the active state is synchronized", async () => {
    db.rows.transactions = {
      id: transactionId,
      customer_id: buyerId,
      vehicle_id: "car-1",
      current_state: "approved",
      purchase_details: { payment_method: "financing" },
      payment_terms: { state: "pending" },
    };
    db.rows.field_cases = { id: "delivered-case" };
    await expect(cancelTransaction(cancellation())).resolves.toMatchObject({ error: expect.stringContaining("Agree") });
    expect(db.writes).toHaveLength(0);
  });
  it("rejects foreign and terminal transactions", async () => {
    transaction("completed");
    await expect(cancelTransaction(cancellation(true))).resolves.toHaveProperty("error");
    db.rows.transactions = { customer_id: "someone-else", current_state: "approved" };
    await expect(cancelTransaction(cancellation(true))).resolves.toHaveProperty("error");
    expect(db.writes).toHaveLength(0);
  });
  it("keeps the five-hour cutoff for ordinary cancellations", async () => {
    db.rows.transactions = { id: transactionId, customer_id: buyerId, current_state: "approved" };
    db.rows.viewing_arrangements = [{ schedule: "2020-01-01T00:00:00Z" }];
    await expect(cancelTransaction(cancellation())).resolves.toMatchObject({
      error: expect.stringContaining("5 hours"),
    });
  });
  function review(rating = "5", body = "  Helpful team  ") {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    fd.set("rating", rating);
    fd.set("body", body);
    return fd;
  }
  it("only accepts a completed transaction review and trims the body", async () => {
    transaction();
    await expect(submitReview(review())).resolves.toHaveProperty("error");
    transaction("completed");
    await expect(submitReview(review())).resolves.toEqual({ success: true });
    expect(db.writes).toContainEqual(
      expect.objectContaining({
        table: "customer_reviews",
        payload: expect.objectContaining({ body: "Helpful team", rating: 5, customer_id: buyerId }),
      }),
    );
  });
  it("rejects a second review using the unique transaction constraint", async () => {
    transaction("completed");
    db.insertErrors.customer_reviews = { code: "23505", message: "duplicate" };
    await expect(submitReview(review())).resolves.toEqual({ error: "You already reviewed this transaction." });
  });
  it("rejects reviews of someone else's completed transaction", async () => {
    db.rows.transactions = { id: transactionId, customer_id: "other", current_state: "completed" };
    await expect(submitReview(review())).resolves.toEqual({ error: "Transaction not found." });
    expect(db.writes).toHaveLength(0);
  });
  it.each([
    ["0", "text"],
    ["6", "text"],
    ["1.5", "text"],
    ["5", "   "],
    ["5", "x".repeat(2001)],
  ])("rejects invalid review %s", async (rating, body) => {
    transaction("completed");
    await expect(submitReview(review(rating, body))).resolves.toHaveProperty("error");
    expect(db.writes).toHaveLength(0);
  });
});

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
  it.each(["meetup", "delivery"])("rejects saving blank %s locations", async (arrangement_kind) => {
    await expect(
      saveBuyDetails(details({ payment_method: "cash", arrangement_kind, location: "  " })),
    ).resolves.toEqual({ error: "Enter a location for meet-up or delivery." });
    expect(saved()).toBeUndefined();
  });

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
    const meetup = { payment_method: "financing", arrangement_kind: "meetup", location: "Calamba" };

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
        location: arrangement === "gce_visit" ? null : "Calamba",
        condition_acknowledged_at: "2033-01-01T00:00:00.000Z",
        ...extra,
      },
    };
    db.rows.transaction_documents = [
      { document_kind: "valid_id", verification_state: "pending" },
      { document_kind: "valid_id", verification_state: "pending" },
      { document_kind: "proof_of_billing", verification_state: "pending" },
    ];
  };
  const form = () => {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    return fd;
  };
  it.each(["meetup", "delivery"])("rejects submitting blank saved %s location", async (arrangement) => {
    request(arrangement, { location: "  " });
    await expect(submitBuyRequest(form())).resolves.toEqual({ error: "Enter a location for meet-up or delivery." });
    expect(db.writes).toHaveLength(0);
  });
  it("rejects a location different from its booked arrangement", async () => {
    request("meetup");
    db.rows.viewing_arrangements = { schedule: slot, arrangement_kind: "meetup", location: "Elsewhere" };
    await expect(submitBuyRequest(form())).resolves.toMatchObject({ error: expect.stringContaining("matches") });
  });

  it("refuses a request without proof of billing", async () => {
    request("gce_visit");
    db.rows.transaction_documents = [
      { document_kind: "valid_id", verification_state: "pending" },
      { document_kind: "valid_id", verification_state: "pending" },
    ];

    await expect(submitBuyRequest(form())).resolves.toEqual({
      error: "Upload a proof of billing before sending the request.",
    });
    expect(db.writes.some((write) => write.table === "transactions")).toBe(false);
  });

  it("needs the delivery date of a financed delivery at request", async () => {
    request("delivery", { delivery_terms_agreed_at: "2033-01-01T00:00:00.000Z" });

    await expect(submitBuyRequest(form())).resolves.toEqual({ error: "Book the meeting time first." });
  });

  it("does not send a delivery the buyer has not agreed the terms of", async () => {
    request("delivery");
    db.rows.viewing_arrangements = { schedule: slot, arrangement_kind: "delivery", location: "Calamba" };

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
      // T05 P2: a request cannot be sent without a proof of billing.
      { document_kind: "proof_of_billing", verification_state: "pending" },
    ];
    db.rows.viewing_arrangements = { schedule: "2033-03-08T02:00:00.000Z", arrangement_kind: "gce_visit" };

    await expect(submitBuyRequest(form())).resolves.toMatchObject({ success: true });

    const bodies = notify.mock.calls.map((call) => (call[2] as { body: string }).body).join(" ");
    expect(bodies).toContain("3/8/2033, 10:00:00 AM");
  });
});
