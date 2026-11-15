import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getCurrentRole, getUser } = vi.hoisted(() => {
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: unknown }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "is", "not", "or", "order", "limit"])
      builder[step] = () => builder;
    for (const op of ["insert", "update", "upsert"])
      builder[op] = (payload: unknown) => {
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
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser },
    from: db.from,
    rpc: db.rpc,
    storage: { from: vi.fn(() => ({ upload: vi.fn(), remove: vi.fn() })) },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { assignMechanic } from "./actions";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "99999999-9999-4999-8999-999999999999";
const caseId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";

function assign() {
  const form = new FormData();
  form.set("field_case_id", caseId);
  form.set("mechanic_id", mechanicId);
  return assignMechanic(form);
}

const caseUpdates = () =>
  db.writes.filter((write) => write.table === "field_cases" && write.op === "update").map((write) => write.payload);

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: userId } } });
  getCurrentRole.mockResolvedValue("confidential_informant");
  db.rpc.mockResolvedValue({ data: true, error: null });
  db.rows.field_cases = { id: caseId, assigned_confidential_informant: userId };
});

// T11: the Confidential Informant owns only their own cases. The CEO keeps the override.
describe("assignMechanic assignment guard (T11)", () => {
  it("lets the assigned Confidential Informant assign the mechanic", async () => {
    await expect(assign()).resolves.toEqual({ success: true });
    expect(caseUpdates()).toEqual([{ mechanic_id: mechanicId }]);
  });

  it("refuses a Confidential Informant assigned to another case", async () => {
    db.rows.field_cases = { id: caseId, assigned_confidential_informant: otherUserId };

    await expect(assign()).resolves.toEqual({
      error: "Only the Confidential Informant assigned to this field case can assign its mechanic.",
    });
    expect(caseUpdates()).toEqual([]);
  });

  it("refuses a field case that does not exist", async () => {
    db.rows.field_cases = null;

    await expect(assign()).resolves.toEqual({ error: "Field case not found." });
    expect(caseUpdates()).toEqual([]);
  });

  it("keeps the CEO exempt from the assignment check", async () => {
    getCurrentRole.mockResolvedValue("ceo");
    db.rows.field_cases = { id: caseId, assigned_confidential_informant: otherUserId };

    await expect(assign()).resolves.toEqual({ success: true });
    expect(caseUpdates()).toEqual([{ mechanic_id: mechanicId }]);
  });

  it("keeps the role gate in front of the assignment check", async () => {
    getCurrentRole.mockResolvedValue("sales_manager");

    await expect(assign()).resolves.toEqual({ error: "Not authorized to assign mechanics" });
    expect(caseUpdates()).toEqual([]);
  });

  it("still refuses an inactive mechanic", async () => {
    db.rpc.mockResolvedValue({ data: false, error: null });

    await expect(assign()).resolves.toEqual({ error: "The selected user is not an active mechanic." });
    expect(caseUpdates()).toEqual([]);
  });
});
