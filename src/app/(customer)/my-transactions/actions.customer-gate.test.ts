import { describe, expect, it, vi } from "vitest";

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/supabase/server", () => {
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "staff-id" } } })) },
    rpc,
    from,
  };
  return {
    createServerSupabase: vi.fn(async () => client),
    createServerSupabaseClient: vi.fn(async () => client),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(async () => ({
    id: "staff-id",
    email: "",
    email_verified: true,
    role: "sales_manager",
    profile: {},
  })),
}));

import { createBuyTransaction } from "./actions";

describe("customer-only purchase gate", () => {
  it("returns an error for staff before reading or writing transactions", async () => {
    const result = await createBuyTransaction(new FormData());
    expect(result).toEqual({ error: "You do not have permission for this action." });
    expect(from).not.toHaveBeenCalled();
  });
});
