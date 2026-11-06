import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => {
  const rows: Record<string, unknown> = {};
  const filters: unknown[][] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? [], error: null });
    const builder = {
      select: () => builder,
      eq: (key: string, value: unknown) => {
        filters.push([table, key, value]);
        return builder;
      },
      order: () => builder,
      single: answer,
      // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
      then: (resolve: (value: unknown) => unknown) => answer().then(resolve),
    };
    return builder;
  };
  return { db: { rows, filters, from } };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ from: db.from, auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("./_components/showroom-grid", () => ({ ShowroomGrid: () => null }));
vi.mock("./_components/inquiry-buttons", () => ({ InquiryButtons: () => null }));
vi.mock("@/components/vehicle-media-viewer", () => ({ VehicleMediaViewer: () => null }));

import VehicleDetailPage from "./[id]/page";
import ShowroomPage from "./page";

beforeEach(() => {
  db.filters.length = 0;
  for (const key of Object.keys(db.rows)) delete db.rows[key];
});

describe("available-only customer showroom", () => {
  it("queries only available vehicles", async () => {
    await ShowroomPage();
    expect(db.filters).toContainEqual(["vehicles", "listing_state", "available"]);
  });

  it.each(["reserved", "sold", "draft", null])("404s for %s vehicles", async (state) => {
    db.rows.vehicles = state ? { id: "car", listing_state: state } : null;
    await expect(VehicleDetailPage({ params: Promise.resolve({ id: "car" }) })).rejects.toThrow("notFound");
  });

  it("renders an available vehicle", async () => {
    db.rows.vehicles = { id: "car", listing_state: "available" };
    await expect(VehicleDetailPage({ params: Promise.resolve({ id: "car" }) })).resolves.toBeTruthy();
  });
});
