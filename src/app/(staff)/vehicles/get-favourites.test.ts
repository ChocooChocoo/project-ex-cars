import { describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => {
  const rows: Record<string, unknown> = {};
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? [], error: null });
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      single: answer,
      // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
      then: (resolve: (value: unknown) => unknown) => answer().then(resolve),
    };
    return builder;
  };
  return { db: { rows, from } };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: db.from,
    auth: { getUser: async () => ({ data: { user: { id: "customer-1" } } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: db.from }) }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole: async () => "customer" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { getFavourites } from "./actions";

// T11: `favourites.select("vehicle_id, vehicles(*)")` returns every vehicle column, and
// `favourites/page.tsx` renders those rows in a client component. GCE's private columns must be gone by then.
describe("getFavourites", () => {
  it("strips the identifiers and the per-car markup before the rows reach the customer", async () => {
    db.rows.favourites = [
      {
        vehicle_id: "car-1",
        vehicles: {
          id: "car-1",
          make: "Toyota",
          model: "Vios",
          vin: "VIN-1",
          plate_number: "ABC 1234",
          engine_number: "ENG-9",
          chassis_number: "CHS-7",
          financing_markup_pct: "12.00",
        },
      },
    ];

    const favourites = await getFavourites();

    expect(favourites).toEqual([{ id: "car-1", make: "Toyota", model: "Vios" }]);
    for (const field of ["vin", "plate_number", "engine_number", "chassis_number", "financing_markup_pct"]) {
      expect(favourites[0]).not.toHaveProperty(field);
    }
  });

  it("skips a favourite whose vehicle is gone", async () => {
    db.rows.favourites = [{ vehicle_id: "car-1", vehicles: null }];

    await expect(getFavourites()).resolves.toEqual([]);
  });
});
