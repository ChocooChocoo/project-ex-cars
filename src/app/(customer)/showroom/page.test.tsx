import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

// The available-only rule and the stripped fields are enforced by Laravel (CatalogueTest); these tests pin
// the page side of the contract: the endpoints used and Laravel's 404 becoming notFound().
const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock("@/lib/api/server", () => ({ apiGet }));
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
  apiGet.mockReset();
});

describe("customer showroom", () => {
  it("reads the catalogue endpoint", async () => {
    apiGet.mockResolvedValue({ data: { vehicles: [], favourite_ids: [] } });
    await ShowroomPage();
    expect(apiGet).toHaveBeenCalledWith("/api/v1/catalogue/vehicles");
  });

  it("404s when Laravel says the car is not available", async () => {
    apiGet.mockRejectedValue(new ApiError(404, { code: "not_found", message: "Resource not found." }));
    await expect(VehicleDetailPage({ params: Promise.resolve({ id: "car" }) })).rejects.toThrow("notFound");
  });

  it("renders an available vehicle", async () => {
    apiGet.mockResolvedValue({
      data: { vehicle: { id: "car", listing_state: "available", make: "Toyota" }, media: [] },
    });
    await expect(VehicleDetailPage({ params: Promise.resolve({ id: "car" }) })).resolves.toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith("/api/v1/catalogue/vehicles/car");
  });

  it("rethrows an outage instead of hiding it as a 404", async () => {
    apiGet.mockRejectedValue(new ApiError(0, { message: "Laravel API unreachable" }));
    await expect(VehicleDetailPage({ params: Promise.resolve({ id: "car" }) })).rejects.toThrow(
      "Laravel API unreachable",
    );
  });
});
