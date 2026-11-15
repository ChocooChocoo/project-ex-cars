import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, db } = vi.hoisted(() => {
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
  return { getUser: vi.fn(), getCurrentRole: vi.fn(), db: { rows, writes, from } };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser }, from: db.from })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { updateFieldCase } from "./actions";

const informantId = "11111111-1111-4111-8111-111111111111";
const mechanicId = "22222222-2222-4222-8222-222222222222";
const outsiderId = "33333333-3333-4333-8333-333333333333";
const caseId = "44444444-4444-4444-8444-444444444444";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
};

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: caseId,
    case_kind: "acquisition",
    state: "in_progress",
    assigned_confidential_informant: informantId,
    mechanic_id: mechanicId,
    head_security_id: null,
    ...overrides,
  };
}

const update = (state = "accepted") => form({ field_case_id: caseId, state });

beforeEach(() => {
  vi.clearAllMocks();
  db.writes.length = 0;
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  getUser.mockResolvedValue({ data: { user: { id: informantId } } });
  getCurrentRole.mockResolvedValue("confidential_informant");
  db.rows.field_cases = caseRow();
});

describe("updateFieldCase assignment scoping", () => {
  it("refuses an unassigned Confidential Informant", async () => {
    getUser.mockResolvedValue({ data: { user: { id: outsiderId } } });

    await expect(updateFieldCase(update())).resolves.toEqual({
      error: "Only the assigned field team can update this case.",
    });
    expect(db.writes).toHaveLength(0);
  });

  it("refuses an unassigned Mechanic", async () => {
    getUser.mockResolvedValue({ data: { user: { id: outsiderId } } });
    getCurrentRole.mockResolvedValue("mechanic");

    await expect(updateFieldCase(update())).resolves.toEqual({
      error: "Only the assigned field team can update this case.",
    });
    expect(db.writes).toHaveLength(0);
  });

  it("lets the assigned Confidential Informant update the case", async () => {
    await expect(updateFieldCase(update())).resolves.toEqual({ success: true });

    expect(db.writes).toEqual([
      {
        table: "field_cases",
        op: "update",
        payload: expect.objectContaining({ state: "accepted", accepted_at: expect.any(String) }),
      },
    ]);
  });

  it("lets the assigned Mechanic update the case", async () => {
    getUser.mockResolvedValue({ data: { user: { id: mechanicId } } });
    getCurrentRole.mockResolvedValue("mechanic");

    await expect(updateFieldCase(update())).resolves.toEqual({ success: true });
    expect(db.writes).toHaveLength(1);
  });

  it("lets the CEO update any case", async () => {
    getUser.mockResolvedValue({ data: { user: { id: outsiderId } } });
    getCurrentRole.mockResolvedValue("ceo");

    await expect(updateFieldCase(update())).resolves.toEqual({ success: true });
    expect(db.writes).toHaveLength(1);
  });

  it("lets the Sales Manager update any case", async () => {
    getUser.mockResolvedValue({ data: { user: { id: outsiderId } } });
    getCurrentRole.mockResolvedValue("sales_manager");

    await expect(updateFieldCase(update())).resolves.toEqual({ success: true });
    expect(db.writes).toHaveLength(1);
  });

  it("refuses an unknown field case", async () => {
    db.rows.field_cases = null;

    await expect(updateFieldCase(update())).resolves.toEqual({ error: "Field case not found." });
    expect(db.writes).toHaveLength(0);
  });

  it("still refuses a role outside the field case workers", async () => {
    getCurrentRole.mockResolvedValue("head_security");

    await expect(updateFieldCase(update())).resolves.toEqual({ error: "Not authorized to update field cases" });
    expect(db.writes).toHaveLength(0);
  });

  it("keeps the completed-state expenses gate for an assigned worker", async () => {
    db.rows.field_cases = caseRow({ transaction_id: "tx" });
    db.rows.field_case_expenses = null;

    await expect(updateFieldCase(update("completed"))).resolves.toEqual({
      error: "File the meet-up expenses with proofs before completing this case.",
    });
    expect(db.writes).toHaveLength(0);
  });
});
