import { expect, it, vi } from "vitest";

const { apiPublicGet } = vi.hoisted(() => ({
  apiPublicGet: vi.fn(async () => ({ content: [], cars: [], reviews: { reviews: [], average: null, count: 0 } })),
}));
vi.mock("@/lib/api/server", () => ({ apiPublicGet }));

import LandingPage from "./page";

// Laravel filters to available cars (backend/tests/Feature/Catalogue/CatalogueTest.php); the page must use
// that public endpoint with the page's revalidate window, never a session-bound call.
it("reads the public landing endpoint", async () => {
  await LandingPage();
  expect(apiPublicGet).toHaveBeenCalledWith("/api/v1/catalogue/landing", 60);
});
