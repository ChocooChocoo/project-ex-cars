import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, notify, db } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: every read of a table answers with the row
  // set for it, and every write is recorded.
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
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
  return { getUser: vi.fn(), getCurrentRole: vi.fn(), notify: vi.fn(), db: { rows, writes, from } };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { completeFinancingAgreement, confirmFinancingTerms, proposeFinancingTerms } from "./financing-actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";

function form(fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("transaction_id", transactionId);
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function request(arrangement: string, overrides: Record<string, unknown> = {}) {
  db.rows.transactions = {
    id: transactionId,
    customer_id: "buyer-1",
    vehicle_id: "car-1",
    current_state: "approved",
    flow_status: null,
    transaction_kind: "buy",
    purchase_details: { payment_method: "financing", arrangement_kind: arrangement },
    payment_records: [],
    ...overrides,
  };
}

const terms = (row: Record<string, unknown> | null) => {
  db.rows.payment_terms = row;
};

const written = (table: string) => db.writes.filter((write) => write.table === table).map((write) => write.payload);

const offer = {
  duration_months: "12",
  total_amount: "500000",
  down_payment: "100000",
  monthly_payment: "33334",
  first_due_date: "2033-12-01",
  missed_payment_policy: "After 4 missed months GCE takes back the vehicle.",
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: userId } } });
  getCurrentRole.mockResolvedValue("sales_manager");
});

describe("proposeFinancingTerms", () => {
  it("stores the monthly payment and the missed payment policy with the terms", async () => {
    request("gce_visit");

    await expect(proposeFinancingTerms(form(offer))).resolves.toEqual({ success: true });
    expect(written("payment_terms")[0]).toMatchObject({
      total_amount: 500000,
      down_payment: 100000,
      monthly_payment: 33334,
      missed_payment_policy: "After 4 missed months GCE takes back the vehicle.",
      delivery_fee: null,
    });
  });

  it("defaults the total to the car's price plus 10% when left blank", async () => {
    request("gce_visit", {
      purchase_details: { payment_method: "financing", arrangement_kind: "gce_visit", final_price: 1_000_000 },
    });

    await expect(proposeFinancingTerms(form({ ...offer, total_amount: "" }))).resolves.toEqual({ success: true });
    expect(written("payment_terms")[0]).toMatchObject({ total_amount: 1_100_000 });
  });

  it.each([
    ["monthly_payment", "Enter the monthly payment."],
    ["missed_payment_policy", "State the missed payment policy."],
  ])("refuses terms without %s", async (field, error) => {
    request("gce_visit");

    await expect(proposeFinancingTerms(form({ ...offer, [field]: "" }))).resolves.toEqual({ error });
    expect(written("payment_terms")).toEqual([]);
  });

  it("takes no downpayment on a meet-up", async () => {
    request("meetup");

    await expect(proposeFinancingTerms(form(offer))).resolves.toEqual({ success: true });
    expect(written("payment_terms")[0]).toMatchObject({ down_payment: 0 });
  });

  it("needs the delivery fee and the downpayment on a delivery", async () => {
    request("delivery");

    await expect(proposeFinancingTerms(form(offer))).resolves.toEqual({ error: "Enter the delivery fee." });
    await expect(proposeFinancingTerms(form({ ...offer, delivery_fee: "2500", down_payment: "" }))).resolves.toEqual({
      error: "Enter the downpayment.",
    });
    expect(written("payment_terms")).toEqual([]);

    await expect(proposeFinancingTerms(form({ ...offer, delivery_fee: "2500" }))).resolves.toEqual({ success: true });
    expect(written("payment_terms")[0]).toMatchObject({ delivery_fee: 2500, down_payment: 100000 });
  });
});

describe("confirmFinancingTerms on a delivery", () => {
  beforeEach(() => {
    getCurrentRole.mockResolvedValue("ceo");
    request("delivery");
    terms({
      id: "terms-1",
      state: "ha_approved",
      total_amount: 500000,
      down_payment: 100000,
      number_of_payments: 12,
      monthly_payment: 33334,
      delivery_fee: 2500,
    });
    db.rows.viewing_arrangements = { schedule: "2033-03-08T02:00:00.000Z", location: "12 Mabini St, Calamba" };
  });

  it("writes the fee, the downpayment and the payment deadline, and holds the car for the buyer", async () => {
    await expect(confirmFinancingTerms(form({ decision: "confirm" }))).resolves.toEqual({ success: true });

    expect(written("purchase_details")[0]).toMatchObject({
      delivery_serviceable: true,
      delivery_fee: 2500,
      downpayment_amount: 100000,
      downpayment_due_at: expect.any(String),
    });
    expect(written("transactions")).toContainEqual({ flow_status: "purchase_claim" });
  });

  it("sends the buyer the breakdown", async () => {
    await confirmFinancingTerms(form({ decision: "confirm" }));

    const [, to, message] = notify.mock.calls.find(([, recipient]) => "userId" in recipient) ?? [];
    expect(to).toEqual({ userId: "buyer-1" });
    for (const part of ["₱2,500", "₱100,000", "₱102,500", "₱400,000", "₱33,334"]) {
      expect(message.body).toContain(part);
    }
  });

  it("is refused when the request has no delivery date", async () => {
    db.rows.viewing_arrangements = null;

    await expect(confirmFinancingTerms(form({ decision: "confirm" }))).resolves.toEqual({
      error: "The request has no delivery date.",
    });
    expect(written("purchase_details")).toEqual([]);
  });
});

describe("completeFinancingAgreement", () => {
  const approved = { id: "terms-1", purchase_transaction_id: transactionId, state: "approved" };
  const NOT_REPORTED = {
    error: "Complete the agreement after the Confidential Informant reports that the buyer signed.",
  };

  beforeEach(() => {
    getCurrentRole.mockResolvedValue("head_accountant");
    terms({
      ...approved,
      total_amount: 500000,
      down_payment: 0,
      number_of_payments: 12,
      payment_frequency: "monthly",
      first_due_date: "2033-12-01",
    });
    db.rows.installment_accounts = { id: "account-1" };
  });

  it("waits for the signing report on a meet-up, not for a downpayment", async () => {
    request("meetup", { flow_status: "gce_visit_scheduled_dp_pending" });
    db.rows.sale_handovers = { contract_state: "signed" };
    await expect(completeFinancingAgreement(form())).resolves.toEqual(NOT_REPORTED);

    db.rows.sale_handovers = { contract_state: "signed", signing_reported_at: "2033-03-08T03:00:00.000Z" };
    await expect(completeFinancingAgreement(form())).resolves.toEqual({ success: true });
    expect(written("transactions")).toContainEqual({ flow_status: "financing_active" });
  });

  it("needs the delivery, the confirmed downpayment and the signing report on a delivery", async () => {
    request("delivery", { flow_status: "initial_dp_confirmed" });
    db.rows.field_cases = { delivery_status: "delivered" };
    db.rows.sale_handovers = null;
    await expect(completeFinancingAgreement(form())).resolves.toEqual(NOT_REPORTED);

    db.rows.sale_handovers = { signing_reported_at: "2033-03-08T03:00:00.000Z" };
    await expect(completeFinancingAgreement(form())).resolves.toEqual({ success: true });
  });

  it("still waits for the confirmed Initial Downpayment at a GCE visit", async () => {
    request("gce_visit", { flow_status: "purchase_claim" });

    await expect(completeFinancingAgreement(form())).resolves.toEqual({
      error: "Complete the agreement after the Initial Downpayment is confirmed.",
    });
  });
});
