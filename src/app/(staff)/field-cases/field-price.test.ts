import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, notify, db } = vi.hoisted(() => {
  // Minimal Supabase builder: reads answer with the row set for the table, writes are recorded.
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "order", "limit"]) builder[step] = () => builder;
    builder.update = (payload: Record<string, unknown>) => {
      writes.push({ table, op: "update", payload });
      return builder;
    };
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
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser } })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { recordFieldPrice } from "./sell-inspection-actions";

const informantId = "11111111-1111-4111-8111-111111111111";
const caseId = "33333333-3333-4333-8333-333333333333";
const transactionId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: informantId } } });
  getCurrentRole.mockResolvedValue("confidential_informant");
  db.rows.field_cases = {
    id: caseId,
    transaction_id: transactionId,
    case_kind: "acquisition",
    state: "in_progress",
    assigned_confidential_informant: informantId,
    mechanic_id: null,
    price_status: null,
  };
  db.rows.sell_details = { agreed_price: 500000 };
});

const sellDetailWrites = () => db.writes.filter((write) => write.table === "sell_details");

describe("recordFieldPrice", () => {
  it("refuses anyone but the assigned Confidential Informant", async () => {
    getCurrentRole.mockResolvedValue("mechanic");
    await expect(recordFieldPrice(caseId, { status: "negotiated" })).resolves.toHaveProperty("error");

    getCurrentRole.mockResolvedValue("confidential_informant");
    getUser.mockResolvedValue({ data: { user: { id: "44444444-4444-4444-8444-444444444444" } } });
    await expect(recordFieldPrice(caseId, { status: "negotiated" })).resolves.toEqual({
      error: "Only the assigned field team can update this case.",
    });
    expect(db.writes).toHaveLength(0);
  });

  it("keeps the confirmed price when negotiated", async () => {
    await expect(recordFieldPrice(caseId, { status: "negotiated" })).resolves.toEqual({ success: true });
    expect(db.writes).toEqual([
      {
        table: "field_cases",
        op: "update",
        payload: { price_status: "negotiated", updated_price: null, discount_amount: null },
      },
    ]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("updates the agreed price and alerts the Marketing Specialist, Sales Manager and CEO", async () => {
    await expect(
      recordFieldPrice(caseId, { status: "displayed_price", updatedPrice: "470000", discountAmount: "30000" }),
    ).resolves.toEqual({ success: true });
    expect(db.writes[0]?.payload).toEqual({
      price_status: "displayed_price",
      updated_price: 470000,
      discount_amount: 30000,
    });
    expect(sellDetailWrites()).toEqual([{ table: "sell_details", op: "update", payload: { agreed_price: 470000 } }]);
    expect(notify.mock.calls.map(([, to]) => to)).toEqual([
      { role: "marketing_specialist" },
      { role: "sales_manager" },
      { role: "ceo" },
    ]);
    expect(notify.mock.calls[0]?.[2]).toMatchObject({ kind: "field_price_changed", transactionId });
  });

  it("validates the amounts", async () => {
    await expect(
      recordFieldPrice(caseId, { status: "displayed_price", updatedPrice: "0", discountAmount: "0" }),
    ).resolves.toEqual({ error: "Enter an updated price above zero." });
    await expect(
      recordFieldPrice(caseId, { status: "displayed_price", updatedPrice: "470000", discountAmount: "-1" }),
    ).resolves.toEqual({ error: "The discount cannot be negative." });
    await expect(
      recordFieldPrice(caseId, { status: "displayed_price", updatedPrice: "500000", discountAmount: "0" }),
    ).resolves.toEqual({ error: "That is the confirmed price. Choose Negotiated instead." });
    expect(db.writes).toHaveLength(0);
  });

  it("does not let Negotiated hide a price already changed on site", async () => {
    (db.rows.field_cases as Record<string, unknown>).price_status = "displayed_price";
    await expect(recordFieldPrice(caseId, { status: "negotiated" })).resolves.toEqual({
      error: "The price was already changed at inspection.",
    });
    expect(db.writes).toHaveLength(0);
  });
});
