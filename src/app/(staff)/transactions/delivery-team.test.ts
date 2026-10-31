import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, db, notify, rpc } = vi.hoisted(() => {
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
  return { getUser: vi.fn(), getCurrentRole: vi.fn(), db: { rows, writes, from }, notify: vi.fn(), rpc: vi.fn() };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/transactions/buy-flow-server", () => ({ releaseVisitSlots: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { createDeliveryFieldCase } from "./delivery-actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const informantId = "33333333-3333-4333-8333-333333333333";
const securityId = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  getCurrentRole.mockResolvedValue("sales_manager");
  notify.mockResolvedValue(undefined);
  rpc.mockResolvedValue({
    data: [
      { account_id: informantId, role: "confidential_informant" },
      { account_id: securityId, role: "head_security" },
    ],
    error: null,
  });
  db.rows.transactions = {
    id: transactionId,
    customer_id: "buyer-1",
    vehicle_id: "car-1",
    current_state: "approved",
    flow_status: null,
    transaction_kind: "buy",
    opened_at: "2026-10-20T00:00:00.000Z",
    purchase_details: {
      arrangement_kind: "delivery",
      payment_method: "cash",
      delivery_serviceable: true,
      delivery_fee: 1000,
      downpayment_amount: 5000,
    },
    payment_records: [{ payment_kind: "delivery_fee", amount: 1000, verified_by: "accountant-1" }],
    viewing_arrangements: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        schedule: "2026-11-10T02:00:00.000Z",
        location: "Makati",
        arrangement_kind: "delivery",
        confirmation_state: "confirmed",
      },
    ],
  };
  db.rows.field_cases = null;
});

describe("createDeliveryFieldCase without a Mechanic (T05)", () => {
  it("creates the delivery case from the Informant and the Head Security only", async () => {
    const form = new FormData();
    form.set("transaction_id", transactionId);
    form.set("informant_id", informantId);
    form.set("head_security_id", securityId);

    await expect(createDeliveryFieldCase(form)).resolves.toEqual({ success: true });

    const insert = db.writes.find((write) => write.table === "field_cases" && write.op === "insert");
    expect(insert?.payload).toMatchObject({
      transaction_id: transactionId,
      case_kind: "delivery",
      assigned_confidential_informant: informantId,
      head_security_id: securityId,
    });
    expect(insert?.payload).not.toHaveProperty("mechanic_id");
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
