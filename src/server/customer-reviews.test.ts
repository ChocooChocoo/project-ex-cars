import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, eq, select, order, limit } = vi.hoisted(() => ({
  from: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));

import { getPublishedReviews } from "./customer-reviews";

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ eq });
  order.mockReturnValue({ limit });
});

describe("landing reviews", () => {
  it("reads published reviews with public joins and calculates average across all reviews", async () => {
    eq.mockReturnValueOnce({ order }).mockResolvedValueOnce({ data: [{ rating: 5 }, { rating: 3 }], error: null });
    limit.mockResolvedValue({ data: [{ id: "review", rating: 5, body: "Helpful" }], error: null });
    const result = await getPublishedReviews();
    expect(result).toMatchObject({ average: 4, count: 2, reviews: [{ id: "review" }] });
    expect(eq).toHaveBeenNthCalledWith(1, "state", "published");
    expect(eq).toHaveBeenNthCalledWith(2, "state", "published");
    expect(select).toHaveBeenCalledWith(expect.stringContaining("profiles(full_name), vehicles(make, model, year)"));
    expect(limit).toHaveBeenCalledWith(6);
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
  it("shows no invented reviews or average on empty/error results", async () => {
    eq.mockReturnValueOnce({ order }).mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
    limit.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(getPublishedReviews()).resolves.toEqual({ average: null, count: 0, reviews: [] });
  });
});
