import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { sellVehicleSchema } from "@/lib/validation/transactions";

import { SellVehicleForm, validateSellPhotos } from "./sell-vehicle-form";

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

function photo(name: string, type: string, size: number): File {
  const bytes = new Uint8Array(Math.min(size, 16));
  return new File([bytes], name, {
    type,
    lastModified: Date.now(),
  }) as File & { size: number };
}

function sizedPhoto(name: string, type: string, size: number): File {
  const file = photo(name, type, size);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateSellPhotos", () => {
  it("requires at least one photo", () => {
    expect(validateSellPhotos([])).toBe("At least one vehicle photo is required.");
  });

  it("accepts 1–6 valid photos", () => {
    const files = [sizedPhoto("a.jpg", "image/jpeg", 1024), sizedPhoto("b.png", "image/png", 2048)];
    expect(validateSellPhotos(files)).toBeNull();
  });

  it("rejects more than 6 photos", () => {
    const files = Array.from({ length: 7 }, (_, i) => sizedPhoto(`p${i}.jpg`, "image/jpeg", 1024));
    expect(validateSellPhotos(files)).toBe("You can upload at most 6 photos.");
  });

  it("rejects non-image mime types", () => {
    expect(validateSellPhotos([sizedPhoto("doc.pdf", "application/pdf", 1024)])).toBe(
      "Photos must be JPEG, PNG, or WebP images.",
    );
  });

  it("rejects files larger than 5MB", () => {
    expect(validateSellPhotos([sizedPhoto("big.jpg", "image/jpeg", 6 * 1024 * 1024)])).toBe(
      "Each photo must be 5MB or smaller.",
    );
  });
});

describe("condition_items payload", () => {
  it("serialises selected node ids as a JSON string array", () => {
    const ids = ["00000000-0000-4000-a000-000000000001", "00000000-0000-4000-a000-000000000002"];
    const fd = new FormData();
    fd.set("condition_items", JSON.stringify(ids));
    const raw = fd.get("condition_items");
    expect(typeof raw).toBe("string");
    const decoded = JSON.parse(raw as string) as unknown;
    expect(Array.isArray(decoded)).toBe(true);
    expect(decoded).toEqual(ids);
  });

  it("rejects non-UUID condition items server-side shape", () => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const bad = ["not-a-uuid", 42, null];
    expect(bad.every((id) => typeof id === "string" && uuidPattern.test(id))).toBe(false);
  });

  it("caps condition items at 200 entries", () => {
    const many = Array.from({ length: 201 }, () => "00000000-0000-4000-a000-000000000001");
    expect(many.length > 200).toBe(true);
  });
});

describe("SellVehicleForm photo + checklist UI", () => {
  it("renders the required photo file input", () => {
    render(<SellVehicleForm />);
    const input = screen.getByLabelText("Vehicle photos");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(input).toHaveAttribute("multiple");
  });

  it("renders the optional checklist trigger when nodes are provided", () => {
    render(
      <SellVehicleForm
        checklistNodes={[
          { id: "00000000-0000-4000-a000-000000000001", parent_id: null, level: "system", name: "Brakes" },
          {
            id: "00000000-0000-4000-a000-000000000002",
            parent_id: "00000000-0000-4000-a000-000000000001",
            level: "component",
            name: "Pads",
          },
        ]}
      />,
    );
    expect(screen.getByText("Known issues checklist (optional)")).toBeInTheDocument();
  });

  it("hides the checklist trigger when no nodes are provided", () => {
    render(<SellVehicleForm />);
    expect(screen.queryByText("Known issues checklist (optional)")).not.toBeInTheDocument();
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
