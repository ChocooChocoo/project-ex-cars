import { beforeEach, describe, expect, it, vi } from "vitest";

const { eq, insert, maybeSingle, select, upsert, getUser, from } = vi.hoisted(() => {
  const eq = vi.fn();
  const insert = vi.fn();
  const maybeSingle = vi.fn();
  const select = vi.fn();
  const upsert = vi.fn();
  const getUser = vi.fn();
  const from = vi.fn();
  return { eq, insert, maybeSingle, select, upsert, getUser, from };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser },
    from,
  })),
}));

type Transaction = { id: string; customer_id: string; transaction_kind: string };

import { saveBuyDetails } from "./actions";

const customerId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";

function detailsForm() {
  const form = new FormData();
  form.set("transaction_id", transactionId);
  form.set("payment_method", "cash");
  form.set("arrangement_kind", "gce_visit");
  form.set("schedule", "2026-09-15T10:00:00.000Z");
  return form;
}

describe("saveBuyDetails ownership guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: customerId } }, error: null });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ maybeSingle });
    upsert.mockResolvedValue({ error: null });
    insert.mockResolvedValue({ error: null });
    from.mockImplementation((table: string) => {
      if (table === "transactions") return { select };
      if (table === "purchase_details") return { upsert };
      if (table === "viewing_arrangements") return { insert };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("rejects an arrangement save for a transaction owned by another customer before any write", async () => {
    const foreignTransaction: Transaction = {
      id: transactionId,
      customer_id: "33333333-3333-4333-8333-333333333333",
      transaction_kind: "buy",
    };
    maybeSingle.mockResolvedValue({ data: foreignTransaction, error: null });

    await expect(saveBuyDetails(detailsForm())).resolves.toEqual({ error: "Transaction not found." });
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an arrangement save for a sell transaction before any write", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: transactionId, customer_id: customerId, transaction_kind: "sell" },
      error: null,
    });

    await expect(saveBuyDetails(detailsForm())).resolves.toEqual({
      error: "Purchase details can only be saved for buy transactions.",
    });
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
