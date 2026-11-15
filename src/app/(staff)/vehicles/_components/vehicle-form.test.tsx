import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }) }));
vi.mock("@/app/(staff)/vehicles/actions", () => ({
  createVehicle: vi.fn(() => Promise.resolve({ success: true })),
  updateVehicle: vi.fn(() => Promise.resolve({ success: true })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { VehicleForm } from "./vehicle-form";

describe("T11: the per-car financing markup field", () => {
  it("shows GCE's global markup as the placeholder", () => {
    render(<VehicleForm defaultMarkupPct={12.5} />);

    const input = screen.getByLabelText("Financing markup %");
    expect(input).toHaveAttribute("placeholder", "12.5");
    expect(input).toHaveValue(null);
  });

  it("falls back to the original 10% before the global setting arrives", () => {
    render(<VehicleForm />);

    expect(screen.getByLabelText("Financing markup %")).toHaveAttribute("placeholder", "10");
  });

  it("no longer offers a pricing type", () => {
    render(<VehicleForm />);

    expect(screen.queryByText("Pricing Type")).not.toBeInTheDocument();
    expect(screen.queryByText("Negotiable Price")).not.toBeInTheDocument();
  });

  it("accepts a markup typed into the field", () => {
    render(<VehicleForm defaultMarkupPct={10} />);

    const input = screen.getByLabelText("Financing markup %");
    fireEvent.change(input, { target: { value: "12" } });
    expect(input).toHaveValue(12);
  });
});
