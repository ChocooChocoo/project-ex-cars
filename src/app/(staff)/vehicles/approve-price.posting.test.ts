import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentRole, vehicleUpdates, vehicleRow } = vi.hoisted(() => ({
  getCurrentRole: vi.fn(),
  vehicleUpdates: [] as Record<string, unknown>[],
  vehicleRow: { current: { posted_at: null as string | null } },
}));

// Minimal PostgREST-style chain: selects resolve to rows, updates record their payload.
function chain(table: string) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "insert"]) builder[method] = () => builder;
  builder.update = (payload: Record<string, unknown>) => {
    if (table === "vehicles") vehicleUpdates.push(payload);
    return builder;
  };
  builder.maybeSingle = async () => {
    if (table === "vehicle_price_proposals") {
      return {
        data: {
          vehicle_id: "33333333-3333-4333-8333-333333333333",
          proposed_amount: 480000,
          decision: "pending",
          proposal_kind: "selling_price",
          transaction_id: null,
        },
        error: null,
      };
    }
    if (table === "vehicles") return { data: vehicleRow.current, error: null };
    return { data: null, error: null };
  };
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
  createAdminClient: vi.fn(() => ({ from: (table: string) => chain(table) })),
}));
vi.mock("@/lib/transactions/sell-flow-server", () => ({ applyCeilingDecision: vi.fn() }));

import { approvePrice } from "./actions";

function approveSellingPrice() {
  const form = new FormData();
  form.set("proposal_id", "22222222-2222-4222-8222-222222222222");
  form.set("decision", "approved");
  return approvePrice(form);
}

describe("approvePrice posting handoff", () => {
  beforeEach(() => {
    vehicleUpdates.length = 0;
    vehicleRow.current = { posted_at: null };
    getCurrentRole.mockResolvedValue("ceo");
  });

  // Test 9: a car GCE bought from a seller must actually be posted, not just marked available.
  it("publishes the approved price with a posted_at so the car reaches the showroom feed", async () => {
    await expect(approveSellingPrice()).resolves.toEqual({ success: true });

    const priced = vehicleUpdates.find((payload) => payload.current_price === 480000);
    const published = vehicleUpdates.find((payload) => payload.listing_state === "available");
    expect(priced).toBeDefined();
    expect(published).toBeDefined();
    expect(typeof published?.posted_at).toBe("string");
  });

  it("keeps the original posted_at when the car was already posted", async () => {
    vehicleRow.current = { posted_at: "2026-10-01T00:00:00.000Z" };

    await expect(approveSellingPrice()).resolves.toEqual({ success: true });

    const published = vehicleUpdates.find((payload) => payload.listing_state === "available");
    expect(published).not.toHaveProperty("posted_at");
  });
});
