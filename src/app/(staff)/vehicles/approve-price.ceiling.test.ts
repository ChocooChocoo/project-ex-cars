import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentRole, applyCeilingDecision, adminTables, pendingProposal } = vi.hoisted(() => ({
  getCurrentRole: vi.fn(),
  applyCeilingDecision: vi.fn(),
  adminTables: [] as string[],
  pendingProposal: { current: null as Record<string, unknown> | null },
}));

// Minimal PostgREST-style chain: every call returns the chain, awaiting it resolves to no error.
function chain(table: string) {
  const result = table === "vehicle_price_proposals" ? { data: pendingProposal.current, error: null } : { error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "update", "insert"]) builder[method] = () => builder;
  builder.maybeSingle = async () => result;
  // biome-ignore lint/suspicious/noThenProperty: the builder must be awaitable like a Supabase query
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ error: null });
  return builder;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } } }) },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      adminTables.push(table);
      return chain(table);
    },
  })),
}));
vi.mock("@/lib/transactions/sell-flow-server", () => ({ applyCeilingDecision }));

import { approvePrice } from "./actions";

function decide(decision: string) {
  const form = new FormData();
  form.set("proposal_id", "22222222-2222-4222-8222-222222222222");
  form.set("decision", decision);
  return approvePrice(form);
}

describe("approvePrice with a sell ceiling (D3)", () => {
  beforeEach(() => {
    adminTables.length = 0;
    getCurrentRole.mockResolvedValue("ceo");
    applyCeilingDecision.mockReset();
    applyCeilingDecision.mockResolvedValue(null);
  });

  it("decides the sell offer and never lists or reprices the seller's car", async () => {
    pendingProposal.current = {
      vehicle_id: "33333333-3333-4333-8333-333333333333",
      proposed_amount: 500000,
      decision: "pending",
      proposal_kind: "purchase_ceiling",
      transaction_id: "44444444-4444-4444-8444-444444444444",
    };

    await expect(decide("approved")).resolves.toEqual({ success: true });
    expect(applyCeilingDecision).toHaveBeenCalledOnce();
    expect(adminTables).not.toContain("vehicles");
  });

  it("still publishes the car when a selling price is approved", async () => {
    pendingProposal.current = {
      vehicle_id: "33333333-3333-4333-8333-333333333333",
      proposed_amount: 900000,
      decision: "pending",
      proposal_kind: "selling_price",
      transaction_id: null,
    };

    await expect(decide("approved")).resolves.toEqual({ success: true });
    expect(applyCeilingDecision).not.toHaveBeenCalled();
    expect(adminTables).toContain("vehicles");
  });

  it("stops before recording the decision when the sell offer cannot take it", async () => {
    pendingProposal.current = {
      vehicle_id: "33333333-3333-4333-8333-333333333333",
      proposed_amount: 500000,
      decision: "pending",
      proposal_kind: "revised_ceiling",
      transaction_id: "44444444-4444-4444-8444-444444444444",
    };
    applyCeilingDecision.mockResolvedValue("This sell offer is not waiting for a ceiling decision.");

    await expect(decide("approved")).resolves.toEqual({
      error: "This sell offer is not waiting for a ceiling decision.",
    });
    expect(adminTables.filter((table) => table === "vehicle_price_proposals")).toHaveLength(1);
  });
});
