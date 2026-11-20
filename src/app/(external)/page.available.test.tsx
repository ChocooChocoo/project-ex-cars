import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { browserApi } = vi.hoisted(() => ({
  browserApi: vi.fn(async () => ({ content: [], cars: [], reviews: { reviews: [], average: null, count: 0 } })),
}));
vi.mock("@/lib/api/client", () => ({ browserApi }));
// The scroll-in animation needs a real browser; jsdom has no IntersectionObserver.
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {
      // no-op
    }
    unobserve() {
      // no-op
    }
    disconnect() {
      // no-op
    }
  },
);

import LandingPage from "./page";

// Laravel filters to available cars (backend/tests/Feature/Catalogue/CatalogueTest.php); the static page
// reads that public endpoint from the browser, without a session.
it("reads the public landing endpoint", async () => {
  render(<LandingPage />);
  await waitFor(() => expect(browserApi).toHaveBeenCalledWith("GET", "/api/v1/catalogue/landing"));
});

it("offers the Android installer as a direct download", async () => {
  render(<LandingPage />);
  const link = await screen.findByRole("link", { name: "Download Mobile App" });

  expect(link).toHaveAttribute("href", "/assets/apk/gce-app-release.apk");
  expect(link).toHaveAttribute("download");
});
