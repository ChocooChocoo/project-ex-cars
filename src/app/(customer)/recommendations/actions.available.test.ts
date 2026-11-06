import { expect, it, vi } from "vitest";

const { eq } = vi.hoisted(() => ({ eq: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => {
    const builder = {
      select: () => builder,
      eq: (key: string, value: string) => {
        eq(key, value);
        return Promise.resolve({ data: [], error: null });
      },
    };
    return { from: () => builder, auth: { getUser: async () => ({ data: { user: { id: "buyer" } } }) } };
  },
}));

import { runRecommendation } from "./actions";

it("ranks available vehicles only, never reserved financing cars", async () => {
  await expect(
    runRecommendation(500000, { make: "Toyota", bodyType: "Sedan", seats: "5", purpose: "Family Car" }),
  ).resolves.toEqual({ error: "No available vehicles found." });
  expect(eq).toHaveBeenCalledWith("listing_state", "available");
});
