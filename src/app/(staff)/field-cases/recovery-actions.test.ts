import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getCurrentRole, getUser } = vi.hoisted(() => {
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: unknown }[] = [];
  const from = (table: string) => {
    let inserted = false;
    const builder: Record<string, unknown> = {};
    const answer = () =>
      Promise.resolve({
        data: inserted && table === "field_cases" ? { id: "case-new" } : (rows[table] ?? null),
        error: null,
      });
    for (const step of ["select", "eq", "neq", "in", "order", "limit"]) builder[step] = () => builder;
    for (const op of ["insert", "update"])
      builder[op] = (payload: unknown) => {
        inserted = op === "insert";
        writes.push({ table, op, payload });
        return builder;
      };
    builder.single = answer;
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return { db: { rows, writes, from, rpc: vi.fn() }, getCurrentRole: vi.fn(), getUser: vi.fn() };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/auth/audit", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser }, from: db.from, rpc: db.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: db.from }) }));

import { assignMechanic, instructRepossession } from "../transactions/actions";
import { advanceRecovery } from "./recovery-actions";

const userId = "11111111-1111-4111-8111-111111111111";
const caseId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
};
beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: userId } } });
  getCurrentRole.mockResolvedValue("confidential_informant");
  db.rpc.mockResolvedValue({ data: true, error: null });
  db.rows.field_cases = {
    id: caseId,
    case_kind: "recovery",
    state: "in_progress",
    assigned_confidential_informant: userId,
    transaction_id: "tx",
    notes: "Tow instruction",
  };
  db.rows.transactions = { id: "tx", vehicle_id: "car" };
});
describe("recovery handover", () => {
  it("creates a mechanic job and notification before closing the case", async () => {
    expect(await advanceRecovery(form({ field_case_id: caseId, state: "completed", mechanic_id: mechanicId }))).toEqual(
      { success: true },
    );
    expect(db.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "reconditioning_jobs",
          payload: expect.objectContaining({ vehicle_id: "car", mechanic_id: mechanicId }),
        }),
        expect.objectContaining({
          table: "notifications",
          payload: expect.objectContaining({ recipient_id: mechanicId, reference_table: "vehicles" }),
        }),
        expect.objectContaining({
          table: "field_cases",
          payload: expect.objectContaining({ state: "completed", mechanic_id: mechanicId }),
        }),
      ]),
    );
  });
  it("denies unassigned CI and inactive mechanic", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "outsider" } } });
    expect(
      await advanceRecovery(form({ field_case_id: caseId, state: "completed", mechanic_id: mechanicId })),
    ).toHaveProperty("error");
    db.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(
      await advanceRecovery(form({ field_case_id: caseId, state: "completed", mechanic_id: mechanicId })),
    ).toHaveProperty("error");
    expect(db.writes).toHaveLength(0);
  });
  it("allows assigned security to accept but not skip to completion", async () => {
    getCurrentRole.mockResolvedValue("head_security");
    db.rows.field_cases = { id: caseId, case_kind: "recovery", state: "assigned", head_security_id: userId };
    expect(await advanceRecovery(form({ field_case_id: caseId, state: "completed" }))).toHaveProperty("error");
    expect(await advanceRecovery(form({ field_case_id: caseId, state: "accepted" }))).toEqual({ success: true });
  });
  it("notifies a newly assigned mechanic", async () => {
    expect(await assignMechanic(form({ field_case_id: caseId, mechanic_id: mechanicId }))).toEqual({ success: true });
    expect(db.writes).toContainEqual(
      expect.objectContaining({
        table: "notifications",
        payload: expect.objectContaining({
          recipient_id: mechanicId,
          reference_table: "field_cases",
          reference_id: caseId,
        }),
      }),
    );
  });
});
describe("towing instruction", () => {
  beforeEach(() => {
    getCurrentRole.mockResolvedValue("head_accountant");
    db.rows.field_cases = [];
    db.rows.installment_accounts = { id: "account" };
    db.rows.installments = Array.from({ length: 4 }, (_, index) => ({
      id: `i${index}`,
      state: "pending",
      due_date: `2020-0${index + 1}-01`,
      amount_due: 100,
    }));
  });
  const request = () =>
    instructRepossession(form({ transaction_id: "tx", informant_id: "ci", head_security_id: "security" }));
  it("creates a case and notifies CI, security and accountant", async () => {
    expect(await request()).toMatchObject({ success: true });
    const notifications = db.writes.find((write) => write.table === "notifications")?.payload;
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recipient_id: "ci", reference_table: "field_cases", reference_id: "case-new" }),
        expect.objectContaining({ recipient_id: "security" }),
        expect.objectContaining({ recipient_role: "head_accountant", reference_table: "transactions" }),
      ]),
    );
  });
  it("blocks scattered misses and duplicate open cases", async () => {
    db.rows.installments = [
      { state: "paid", due_date: "2020-04-01" },
      { state: "pending", due_date: "2020-03-01" },
    ];
    expect(await request()).toHaveProperty("error");
    db.rows.installments = Array.from({ length: 4 }, (_, i) => ({
      state: "pending",
      due_date: `2020-0${i + 1}-01`,
      amount_due: 100,
    }));
    db.rows.field_cases = [{ id: "open" }];
    expect(await request()).toHaveProperty("error", "An open recovery case already exists for this transaction.");
    expect(db.writes).toHaveLength(0);
  });
});
