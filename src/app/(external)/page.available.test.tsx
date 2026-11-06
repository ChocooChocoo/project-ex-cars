import { expect, it, vi } from "vitest";

const { filters } = vi.hoisted(() => ({ filters: [] as unknown[][] }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: (key: string, value: string) => {
          filters.push([table, key, value]);
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [] }).then(resolve),
      };
      return builder;
    },
  }),
}));
vi.mock("@/lib/settings/financing", () => ({ getFinancingMarkupPct: async () => 10 }));
vi.mock("@/server/customer-reviews", () => ({ getPublishedReviews: async () => ({ reviews: [] }) }));

import LandingPage from "./page";

it("shows only available vehicles on the public landing page", async () => {
  await LandingPage();
  expect(filters).toContainEqual(["vehicles", "listing_state", "available"]);
});
