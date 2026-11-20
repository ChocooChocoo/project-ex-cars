import { Component, type ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

// The available-only rule and the stripped fields are enforced by Laravel (CatalogueTest); these tests pin
// the page side: the endpoint used, the real id read from the URL, and Laravel's 404 becoming notFound().
const { browserApi, notFound } = vi.hoisted(() => ({
  browserApi: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("@/lib/api/client", () => ({ browserApi }));
vi.mock("next/navigation", () => ({
  notFound,
  usePathname: () => "/customer/showroom/car-1/",
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("./_components/showroom-grid", () => ({ ShowroomGrid: () => <p>grid</p> }));
vi.mock("./_components/inquiry-buttons", () => ({ InquiryButtons: () => null }));
vi.mock("@/components/vehicle-media-viewer", () => ({ VehicleMediaViewer: () => null }));

// notFound() throws, as in Next.js; this boundary catches it the way Next's not-found boundary would.
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p>not found</p> : this.props.children;
  }
}

import { VehicleDetailPage } from "./_components/vehicle-detail-page";
import ShowroomPage from "./page";

beforeEach(() => {
  browserApi.mockReset();
  notFound.mockClear();
});

describe("customer showroom (static pages)", () => {
  it("reads the catalogue endpoint and shows a skeleton until it answers", async () => {
    browserApi.mockResolvedValue({ vehicles: [], favourite_ids: [] });
    render(<ShowroomPage />);
    expect(screen.getByLabelText("Loading")).toBeTruthy();
    await screen.findByText("grid");
    expect(browserApi).toHaveBeenCalledWith("GET", "/api/v1/catalogue/vehicles");
  });

  it("reads the car id from the URL, not the build placeholder", async () => {
    browserApi.mockResolvedValue({ vehicle: { id: "car-1", listing_state: "available", make: "Toyota" }, media: [] });
    render(<VehicleDetailPage />);
    await screen.findByText(/Toyota/);
    expect(browserApi).toHaveBeenCalledWith("GET", "/api/v1/catalogue/vehicles/car-1");
  });

  it("404s when Laravel says the car is not available", async () => {
    browserApi.mockRejectedValue(new ApiError(404, { code: "not_found", message: "Resource not found." }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <Boundary>
        <VehicleDetailPage />
      </Boundary>,
    );
    await screen.findByText("not found");
    expect(notFound).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("BC-11: shows Interior, Interior features and Best for", async () => {
    browserApi.mockResolvedValue({
      vehicle: {
        id: "car-1",
        listing_state: "available",
        make: "Toyota",
        model: "Innova",
        interior_color: "Black",
        interior_features: "Leather seats, 7 seats, rear AC",
        purpose: "Family Car",
      },
      media: [],
    });
    render(<VehicleDetailPage />);

    const interior = await screen.findByText("Interior");
    expect(interior.nextElementSibling).toHaveTextContent("Black");
    expect(screen.getByText("Interior features").nextElementSibling).toHaveTextContent(
      "Leather seats, 7 seats, rear AC",
    );
    expect(screen.getByText("Best for").nextElementSibling).toHaveTextContent("Family Car");
  });
});
