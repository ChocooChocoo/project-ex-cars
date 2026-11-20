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

  it("SN-1: no longer asks for a condition or warranty details", () => {
    render(<VehicleForm />);

    expect(screen.queryByText("Condition")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Condition" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Warranty Details")).not.toBeInTheDocument();
  });

  it("SN-1: the ₱ addon sits inline before the price, not over it", () => {
    render(<VehicleForm />);

    // The addon takes its own width; the old override positioned it absolutely over the input.
    const addon = screen.getByText("₱");
    expect(addon).toHaveAttribute("data-align", "inline-start");
    const group = addon.closest("[data-slot=input-group]");
    expect(group).not.toBeNull();
    expect(group?.className).not.toMatch(/absolute/);
    expect(group?.querySelector("[data-slot=input-group-control]")?.className).not.toMatch(/pl-8/);
  });

  it("accepts a markup typed into the field", () => {
    render(<VehicleForm defaultMarkupPct={10} />);

    const input = screen.getByLabelText("Financing markup %");
    fireEvent.change(input, { target: { value: "12" } });
    expect(input).toHaveValue(12);
  });
});

describe("BC-11: the interior features field", () => {
  it("asks for the interior as free text next to the interior color", () => {
    render(<VehicleForm />);

    const textarea = screen.getByLabelText("Interior features, e.g. leather seats, 7 seats, rear AC");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveValue("");
    expect(screen.getByText("Interior Color")).toBeInTheDocument();
  });

  it("keeps what the Marketing Specialist types", () => {
    render(<VehicleForm />);

    const textarea = screen.getByLabelText("Interior features, e.g. leather seats, 7 seats, rear AC");
    fireEvent.change(textarea, { target: { value: "Leather seats, 7 seats" } });
    expect(textarea).toHaveValue("Leather seats, 7 seats");
  });

  it("pre-fills the saved interior on an edit form", () => {
    render(
      <VehicleForm
        defaultValues={{
          id: "11111111-1111-4111-8111-111111111111",
          stock_code: "GCE-001",
          vin: "VIN-1",
          plate_number: "ABC 1234",
          engine_number: "ENG-9",
          chassis_number: "CHS-7",
          make: "Toyota",
          model: "Vios",
          year: 2022,
          interior_features: "Leather seats, 7 seats, rear AC",
        }}
      />,
    );

    expect(screen.getByLabelText("Interior features, e.g. leather seats, 7 seats, rear AC")).toHaveValue(
      "Leather seats, 7 seats, rear AC",
    );
  });
});
