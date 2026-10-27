import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, db } = vi.hoisted(() => {
  const rows: Record<string, unknown> = {};
  const writes: { table: string; payload: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq"]) builder[step] = () => builder;
    builder.update = (payload: Record<string, unknown>) => {
      writes.push({ table, payload });
      return builder;
    };
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return { getUser: vi.fn(), getCurrentRole: vi.fn(), db: { rows, writes, from } };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser } })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { updateDeliveryLocation } from "./delivery-actions";

const securityId = "11111111-1111-4111-8111-111111111111";
const caseId = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: securityId } } });
  getCurrentRole.mockResolvedValue("head_security");
  db.rows.field_cases = {
    id: caseId,
    transaction_id: "22222222-2222-4222-8222-222222222222",
    case_kind: "delivery",
    state: "in_progress",
    delivery_status: "in_transit",
    assigned_confidential_informant: null,
    mechanic_id: null,
    head_security_id: securityId,
  };
  db.rows.transactions = { current_state: "approved" };
});

describe("updateDeliveryLocation", () => {
  it("saves the assigned courier's position", async () => {
    await expect(updateDeliveryLocation(caseId, 14.5995, 120.9842)).resolves.toEqual({ success: true });
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]?.payload).toMatchObject({ last_lat: 14.5995, last_lng: 120.9842 });
    expect(db.writes[0]?.payload.last_located_at).toEqual(expect.any(String));
  });

  it("refuses a staff member who is not on the delivery team", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "44444444-4444-4444-8444-444444444444" } } });
    await expect(updateDeliveryLocation(caseId, 14.5, 121)).resolves.toEqual({
      error: "Only the assigned delivery team can update this delivery.",
    });
    getUser.mockResolvedValue({ data: { user: { id: securityId } } });
    getCurrentRole.mockResolvedValue("sales_manager");
    await expect(updateDeliveryLocation(caseId, 14.5, 121)).resolves.toHaveProperty("error");
    expect(db.writes).toHaveLength(0);
  });

  it("checks the latitude and longitude range", async () => {
    await expect(updateDeliveryLocation(caseId, 91, 121)).resolves.toEqual({ error: "Invalid location." });
    await expect(updateDeliveryLocation(caseId, 14.5, -181)).resolves.toEqual({ error: "Invalid location." });
    await expect(updateDeliveryLocation(caseId, Number.NaN, 121)).resolves.toEqual({ error: "Invalid location." });
    expect(db.writes).toHaveLength(0);
  });

  it("only shares while the car is on the road", async () => {
    (db.rows.field_cases as Record<string, unknown>).delivery_status = "delivered";
    await expect(updateDeliveryLocation(caseId, 14.5, 121)).resolves.toEqual({
      error: "Location is shared only while the car is in transit or arriving.",
    });
    expect(db.writes).toHaveLength(0);
  });

  it("refuses a delivery whose transaction is no longer approved", async () => {
    db.rows.transactions = { current_state: "cancelled" };
    await expect(updateDeliveryLocation(caseId, 14.5, 121)).resolves.toEqual({
      error: "This delivery is no longer active.",
    });
    expect(db.writes).toHaveLength(0);
  });
});
