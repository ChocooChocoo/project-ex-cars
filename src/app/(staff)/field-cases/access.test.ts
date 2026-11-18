import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, db } = vi.hoisted(() => {
  // Minimal Supabase builder: reads answer with the row set for the table.
  const rows: Record<string, unknown> = {};
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "order", "limit"]) builder[step] = () => builder;
    builder.maybeSingle = answer;
    builder.single = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return { getUser: vi.fn(), getCurrentRole: vi.fn(), db: { rows, from } };
});

vi.mock("@/lib/auth/server-session", () => ({ getCurrentRole }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser } })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { assignedCase, isAssigned } from "./access";

const informantId = "11111111-1111-4111-8111-111111111111";
const mechanicId = "22222222-2222-4222-8222-222222222222";
const securityId = "33333333-3333-4333-8333-333333333333";
const caseId = "44444444-4444-4444-8444-444444444444";

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: caseId,
    transaction_id: null,
    case_kind: "acquisition",
    state: "in_progress",
    assigned_confidential_informant: informantId,
    mechanic_id: null,
    head_security_id: null,
    identity_confirmed_at: null,
    plate_confirmed_at: null,
    inspection_outcome: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  getUser.mockResolvedValue({ data: { user: { id: informantId } } });
  getCurrentRole.mockResolvedValue("confidential_informant");
  db.rows.field_cases = caseRow();
});

describe("isAssigned", () => {
  it("matches the informant, the mechanic and the head of security", () => {
    const fieldCase = {
      assigned_confidential_informant: informantId,
      mechanic_id: mechanicId,
      head_security_id: securityId,
    };

    expect(isAssigned(fieldCase, informantId)).toBe(true);
    expect(isAssigned(fieldCase, mechanicId)).toBe(true);
    expect(isAssigned(fieldCase, securityId)).toBe(true);
  });

  it("refuses an outsider and an empty case", () => {
    expect(isAssigned({ assigned_confidential_informant: informantId }, "outsider")).toBe(false);
    expect(isAssigned({}, informantId)).toBe(false);
  });

  it("does not match an empty user id against the unassigned columns", () => {
    expect(isAssigned({ assigned_confidential_informant: null, mechanic_id: null }, "")).toBe(false);
  });
});

describe("assignedCase", () => {
  it("returns the case for the assigned Confidential Informant", async () => {
    const context = await assignedCase(caseId);

    expect(context).toMatchObject({
      userId: informantId,
      role: "confidential_informant",
      fieldCase: { id: caseId, case_kind: "acquisition" },
    });
  });

  it("returns the case for the assigned Mechanic", async () => {
    getUser.mockResolvedValue({ data: { user: { id: mechanicId } } });
    getCurrentRole.mockResolvedValue("mechanic");
    db.rows.field_cases = caseRow({ assigned_confidential_informant: null, mechanic_id: mechanicId });

    await expect(assignedCase(caseId)).resolves.toMatchObject({ userId: mechanicId, role: "mechanic" });
  });

  it("refuses an unassigned worker with the assignment error", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "outsider" } } });

    await expect(assignedCase(caseId)).resolves.toEqual({
      error: "Only the assigned field team can update this case.",
    });
  });

  it("refuses a mechanic who is not the case's mechanic", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "another-mechanic" } } });
    getCurrentRole.mockResolvedValue("mechanic");
    db.rows.field_cases = caseRow({ mechanic_id: mechanicId });

    await expect(assignedCase(caseId)).resolves.toEqual({
      error: "Only the assigned field team can update this case.",
    });
  });

  it("lets an allowRole-exempt role through without being named on the case", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "ceo-account" } } });
    getCurrentRole.mockResolvedValue("ceo");

    await expect(assignedCase(caseId)).resolves.toEqual({
      error: "Only the assigned field team can update this case.",
    });
    await expect(assignedCase(caseId, { allowRole: (role) => role === "ceo" })).resolves.toMatchObject({
      userId: "ceo-account",
      role: "ceo",
    });
  });

  it("rejects an unauthenticated caller before reading the case", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(assignedCase(caseId)).resolves.toEqual({ error: "Not authenticated" });
  });

  it("rejects an id that is not a uuid", async () => {
    await expect(assignedCase("not-a-uuid")).resolves.toEqual({ error: "Invalid field case." });
    await expect(assignedCase(null)).resolves.toEqual({ error: "Invalid field case." });
  });

  it("reports a missing case as not found", async () => {
    db.rows.field_cases = null;

    await expect(assignedCase(caseId)).resolves.toEqual({ error: "Field case not found." });
  });

  it("refuses a closed case", async () => {
    db.rows.field_cases = caseRow({ state: "completed" });
    await expect(assignedCase(caseId)).resolves.toEqual({ error: "This field case is closed." });

    db.rows.field_cases = caseRow({ state: "cancelled" });
    await expect(assignedCase(caseId)).resolves.toEqual({ error: "This field case is closed." });
  });
});
