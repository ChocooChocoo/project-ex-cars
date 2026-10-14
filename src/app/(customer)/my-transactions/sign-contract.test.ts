import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, notify, db } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: every read of a table answers with the row
  // set for it, and every write is recorded.
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq"]) builder[step] = () => builder;
    for (const op of ["insert", "update"]) {
      builder[op] = (payload: Record<string, unknown>) => {
        writes.push({ table, op, payload });
        return builder;
      };
    }
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return { getUser: vi.fn(), notify: vi.fn(), db: { rows, writes, from } };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { signContract } from "./actions";

const buyerId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";

function form(name = "Maria Santos") {
  const fd = new FormData();
  fd.set("transaction_id", transactionId);
  fd.set("signed_name", name);
  return fd;
}

const contract = (state: string | null, customerId = buyerId) => {
  db.rows.transactions = {
    id: transactionId,
    customer_id: customerId,
    current_state: "approved",
    sale_handovers: state ? { contract_state: state } : null,
  };
};

const signedWrite = () => db.writes.find((write) => write.table === "sale_handovers")?.payload;

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: buyerId } } });
});

describe("signContract", () => {
  it.each([null, "draft", "pending_approval", "returned"])("refuses a contract that is %s", async (state) => {
    contract(state);

    await expect(signContract(form())).resolves.toEqual({ error: "The contract is not approved yet." });
    expect(signedWrite()).toBeUndefined();
  });

  it("refuses another customer's contract", async () => {
    contract("approved", "someone-else");

    await expect(signContract(form())).resolves.toEqual({ error: "Transaction not found." });
    expect(signedWrite()).toBeUndefined();
  });

  it("needs the buyer's typed name", async () => {
    contract("approved");

    await expect(signContract(form("  "))).resolves.toEqual({ error: "Type your full name to sign." });
  });

  it("refuses a second signature", async () => {
    contract("signed");

    await expect(signContract(form())).resolves.toEqual({ error: "The contract is already signed." });
  });

  it("signs an approved contract with the typed name and the time", async () => {
    contract("approved");

    await expect(signContract(form())).resolves.toEqual({ success: true });
    expect(signedWrite()).toMatchObject({ contract_state: "signed", contract_signed_at: expect.any(String) });
    expect(db.writes).toContainEqual(
      expect.objectContaining({
        table: "transaction_status_history",
        payload: expect.objectContaining({ reason: "Contract signed by Maria Santos" }),
      }),
    );
    expect(notify).toHaveBeenCalledWith(expect.anything(), { role: "sales_manager" }, expect.anything());
  });
});
