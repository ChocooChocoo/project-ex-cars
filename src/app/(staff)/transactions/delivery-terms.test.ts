import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, notify, db } = vi.hoisted(() => {
  // The same minimal query-builder stand-in the financing tests use: a read answers with the row set
  // registered for its table, and every write is recorded so the test can inspect the payload.
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

import { setDeliveryTerms } from "./delivery-actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";

function form(fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("transaction_id", transactionId);
  fd.set("serviceable", "yes");
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function delivery(finalPrice: number, regionCode: string | null) {
  db.rows.transactions = {
    id: transactionId,
    customer_id: "buyer-1",
    vehicle_id: "car-1",
    current_state: "approved",
    flow_status: null,
    transaction_kind: "buy",
    purchase_details: {
      arrangement_kind: "delivery",
      payment_method: "cash",
      final_price: finalPrice,
      downpayment_due_at: null,
    },
    payment_records: [],
    viewing_arrangements: [],
  };
  db.rows.profiles = regionCode === null ? null : { region_code: regionCode };
  db.rows.field_cases = null;
}

const written = (table: string) => db.writes.filter((write) => write.table === table).map((write) => write.payload);

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: userId } } });
  getCurrentRole.mockResolvedValue("sales_manager");
});

describe("setDeliveryTerms without a region", () => {
  it("refuses until the buyer's profile has a region", async () => {
    delivery(500_000, null);

    await expect(setDeliveryTerms(form({ delivery_fee: "9000" }))).resolves.toEqual({
      error: "Buyer has no region in their profile.",
    });
    expect(written("purchase_details")).toEqual([]);
  });
});

describe("setDeliveryTerms fee range", () => {
  it("refuses a Visayas fee of ₱9,000", async () => {
    delivery(500_000, "070000000");

    await expect(setDeliveryTerms(form({ delivery_fee: "9000" }))).resolves.toEqual({
      error: "The delivery fee for Visayas is ₱10,000 – ₱15,000.",
    });
    expect(written("purchase_details")).toEqual([]);
  });

  it("accepts a Visayas fee inside the range", async () => {
    delivery(500_000, "070000000");

    await expect(setDeliveryTerms(form({ delivery_fee: "12000" }))).resolves.toEqual({ success: true });
    expect(written("purchase_details")[0]).toMatchObject({ delivery_fee: 12_000 });
  });

  it("locks a CALABARZON delivery at zero", async () => {
    delivery(500_000, "040000000");

    await expect(setDeliveryTerms(form({ delivery_fee: "5000" }))).resolves.toEqual({ success: true });
    expect(written("purchase_details")[0]).toMatchObject({ delivery_fee: 0, delivery_serviceable: true });
  });
});

describe("setDeliveryTerms down payment", () => {
  it("computes 10% of the vehicle price and ignores the posted amount", async () => {
    delivery(500_000, "040000000");

    await expect(setDeliveryTerms(form({ delivery_fee: "0", downpayment_amount: "1" }))).resolves.toEqual({
      success: true,
    });
    expect(written("purchase_details")[0]).toMatchObject({ downpayment_amount: 50_000 });
  });

  it("refuses a delivery for a request with no vehicle price", async () => {
    delivery(0, "040000000");

    await expect(setDeliveryTerms(form({ delivery_fee: "0" }))).resolves.toEqual({
      error: "Set the vehicle price first.",
    });
    expect(written("purchase_details")).toEqual([]);
  });
});
