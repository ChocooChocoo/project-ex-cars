import { beforeEach, expect, it, vi } from "vitest";

const { getCurrentRole, getUser, db, redirect } = vi.hoisted(() => {
  const rows: Record<string, unknown> = {};
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "in", "neq"]) builder[step] = () => builder;
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return {
    getCurrentRole: vi.fn(),
    getUser: vi.fn(),
    db: { rows, from },
    redirect: vi.fn((path: string) => {
      throw new Error(`redirect:${path}`);
    }),
  };
});

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/server-session", () => ({ getCurrentRole }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from, storage: {} })) }));

import { isPaperReader, PAPER_ROLES, requirePaperReader } from "./paper-access";

const transactionId = "22222222-2222-4222-8222-222222222222";
const buyerId = "11111111-1111-4111-8111-111111111111";
const ciId = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.rows.transactions = { id: transactionId, customer_id: buyerId };
  db.rows.field_cases = { id: "case-1", assigned_confidential_informant: ciId };
  getUser.mockResolvedValue({ data: { user: { id: buyerId } } });
  getCurrentRole.mockResolvedValue("customer");
});

it.each(["ceo", "head_accountant", "sales_manager"])("lets the %s open any paper without a lookup", async (role) => {
  getCurrentRole.mockResolvedValue(role);

  await expect(requirePaperReader(transactionId, PAPER_ROLES)).resolves.toBeUndefined();
  expect(getUser).not.toHaveBeenCalled();
});

it("lets the buyer of the transaction keep their own copy", async () => {
  await expect(requirePaperReader(transactionId, PAPER_ROLES)).resolves.toBeUndefined();
});

it("lets the Confidential Informant assigned to the field case read the papers", async () => {
  getCurrentRole.mockResolvedValue("confidential_informant");
  getUser.mockResolvedValue({ data: { user: { id: ciId } } });

  await expect(requirePaperReader(transactionId, PAPER_ROLES)).resolves.toBeUndefined();
});

it("sends everyone else to /unauthorized", async () => {
  getCurrentRole.mockResolvedValue("mechanic");
  getUser.mockResolvedValue({ data: { user: { id: "someone-else" } } });

  await expect(requirePaperReader(transactionId, PAPER_ROLES)).rejects.toThrow("redirect:/unauthorized");
});

it("refuses a customer who bought a different car", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "another-customer" } } });

  await expect(requirePaperReader(transactionId, PAPER_ROLES)).rejects.toThrow("redirect:/unauthorized");
});

it("refuses a paper nobody can read when the transaction is unknown", async () => {
  db.rows.transactions = null;
  db.rows.field_cases = null;

  await expect(isPaperReader({ from: db.from } as never, transactionId, buyerId)).resolves.toBe(false);
});
