import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { sellVehicleSchema } from "@/lib/validation/transactions";

import { SellVehicleForm } from "./sell-vehicle-form";

if (typeof window !== "undefined" && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView =
    vi.fn() as unknown as typeof window.HTMLElement.prototype.scrollIntoView;
}
if (typeof Element !== "undefined" && !(Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView) {
  (Element.prototype as unknown as Record<string, unknown>).scrollIntoView = vi.fn();
}
if (typeof globalThis !== "undefined" && !(globalThis as unknown as Record<string, unknown>).ResizeObserver) {
  (globalThis as unknown as Record<string, unknown>).ResizeObserver = class {
    observe() {
      // noop
    }
    unobserve() {
      // noop
    }
    disconnect() {
      // noop
    }
  };
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/app/(customer)/my-transactions/actions", () => ({
  submitSellVehicle: vi.fn(async () => ({ success: true, id: "00000000-0000-4000-a000-000000000001" })),
}));

function baseData(overrides: Record<string, unknown> = {}) {
  return {
    make: "Honda",
    model: "Civic",
    year: 2020,
    mileage: 50000,
    condition: "excellent",
    offered_amount: 450000,
    ...overrides,
  };
}

function getVisibleOption(label: string): HTMLElement {
  const candidates = screen.getAllByText(label);
  const visible = candidates.find((el) => el.closest('[data-slot="select-item"]') !== null);
  return (visible ?? candidates[0]) as HTMLElement;
}

describe("sellVehicleSchema condition enum + legacy fallback", () => {
  it("accepts each enum and maps to Title Case", () => {
    const pairs: [string, string][] = [
      ["excellent", "Excellent"],
      ["good", "Good"],
      ["fair", "Fair"],
      ["needs_repair", "Needs Repair"],
    ];
    for (const [raw, expected] of pairs) {
      const parsed = sellVehicleSchema.safeParse(baseData({ condition: raw }));
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.condition).toBe(expected);
    }
  });

  it("transforms legacy Good with trailing space", () => {
    const parsed = sellVehicleSchema.safeParse(baseData({ condition: "Good " }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.condition).toBe("Good");
  });

  it("handles needs repair variants via mapping", () => {
    for (const raw of ["needs repair", "needsrepair", "NEEDS_REPAIR"]) {
      const parsed = sellVehicleSchema.safeParse(baseData({ condition: raw }));
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.condition).toBe("Needs Repair");
    }
  });

  it("allows legacy free-text via title-case fallback", () => {
    const parsed = sellVehicleSchema.safeParse(baseData({ condition: "  custom_condition  " }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.condition).toBe("Custom Condition");
  });

  it("allows condition_detail optional and keeps DB shape", () => {
    const parsed = sellVehicleSchema.safeParse(baseData({ condition: "other", condition_detail: "Minor scratches" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.condition).toBe("Other");
      expect(parsed.data.condition_detail).toBe("Minor scratches");
    }
  });

  it("rejects empty condition", () => {
    const parsed = sellVehicleSchema.safeParse(baseData({ condition: "" }));
    expect(parsed.success).toBe(false);
  });

  it("keeps same DB insert shape with vehicles.condition TEXT", () => {
    const parsed = sellVehicleSchema.safeParse(baseData({ condition: "excellent" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(typeof parsed.data.condition).toBe("string");
      expect(parsed.data.condition.length).toBeGreaterThan(0);
      expect(parsed.data.condition.length).toBeLessThanOrEqual(50);
    }
  });
});

describe("SellVehicleForm Select + Other detail", () => {
  it("renders condition Select with placeholder", () => {
    render(<SellVehicleForm />);
    expect(screen.getByText("Condition *")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Select condition")).toBeInTheDocument();
  });

  it("renders 4 enum items + Other when opened", async () => {
    render(<SellVehicleForm />);
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getAllByText("Excellent").length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText("Good").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Fair").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Needs Repair").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Other").length).toBeGreaterThanOrEqual(1);
    expect(getVisibleOption("Excellent")).toBeInTheDocument();
    expect(getVisibleOption("Other")).toBeInTheDocument();
  });

  it("reveals detail textarea when Other selected", async () => {
    render(<SellVehicleForm />);
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getAllByText("Other").length).toBeGreaterThanOrEqual(1));
    const otherOption = getVisibleOption("Other");
    fireEvent.click(otherOption);
    await waitFor(() => expect(screen.getByPlaceholderText("Describe the condition...")).toBeInTheDocument());
  });

  it("keeps detail hidden for non-Other selection", async () => {
    render(<SellVehicleForm />);
    expect(screen.queryByPlaceholderText("Describe the condition...")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getAllByText("Good").length).toBeGreaterThanOrEqual(1));
    const goodOption = getVisibleOption("Good");
    fireEvent.click(goodOption);
    await waitFor(() => expect(screen.queryByPlaceholderText("Describe the condition...")).not.toBeInTheDocument());
  });
});
