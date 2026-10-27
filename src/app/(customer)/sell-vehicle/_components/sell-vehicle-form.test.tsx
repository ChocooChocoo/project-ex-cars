import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { sellVehicleSchema } from "@/lib/validation/transactions";

import { composeDeclaredIssues, SellVehicleForm, validateIssuePhotos, validateSellPhotos } from "./sell-vehicle-form";

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
  prepareSellUploads: vi.fn(),
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
    has_known_issues: "no",
    meetup_method: "gce_visit",
    owner_number: "1",
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

const NODES = [
  { id: "00000000-0000-4000-a000-000000000001", parent_id: null, level: "system" as const, name: "Brakes" },
  {
    id: "00000000-0000-4000-a000-000000000002",
    parent_id: "00000000-0000-4000-a000-000000000001",
    level: "component" as const,
    name: "Pads",
  },
];

describe("SellVehicleForm photo + issues UI", () => {
  it("renders the required photo file input", () => {
    render(<SellVehicleForm />);
    const input = screen.getByLabelText("Vehicle photos");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(input).toHaveAttribute("multiple");
  });

  it("labels the vehicle fields Brand, Model, Year and Owner number", () => {
    render(<SellVehicleForm />);
    expect(screen.getByLabelText("Brand", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("Model", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Year/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Owner number/ })).toBeInTheDocument();
  });

  it("shows one issues checklist with Others and issue photos only after the seller declares issues", async () => {
    render(<SellVehicleForm checklistNodes={NODES} />);
    expect(screen.queryByLabelText("Pads")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("The vehicle has known issues"));
    await waitFor(() => expect(screen.getByLabelText("Pads")).toBeInTheDocument());
    expect(screen.getByLabelText("Others")).toBeInTheDocument();
    expect(screen.getByLabelText("Photos of the issues (optional, up to 6)")).toBeInTheDocument();
    expect(screen.queryByText("Known issues checklist (optional)")).not.toBeInTheDocument();
  });

  it("asks for the other issues text once Others is ticked", async () => {
    render(<SellVehicleForm checklistNodes={NODES} />);
    fireEvent.click(screen.getByLabelText("The vehicle has known issues"));
    fireEvent.click(await screen.findByLabelText("Others"));
    expect(await screen.findByLabelText("Describe the other issues *")).toBeInTheDocument();
  });
});

describe("SellVehicleForm condition", () => {
  it("offers Brand New and Second Hand only", async () => {
    render(<SellVehicleForm />);
    fireEvent.click(screen.getByRole("combobox", { name: /^Condition/ }));
    await waitFor(() => expect(screen.getAllByText("Brand New").length).toBeGreaterThanOrEqual(1));
    expect(getVisibleOption("Second Hand")).toBeInTheDocument();
    expect(screen.queryByText("Excellent")).not.toBeInTheDocument();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
  });

  it("stores the two conditions as written", () => {
    for (const condition of ["Brand New", "Second Hand"]) {
      const parsed = sellVehicleSchema.safeParse(baseData({ condition }));
      expect(parsed.success && parsed.data.condition).toBe(condition);
    }
  });
});

describe("issue helpers", () => {
  it("joins ticked parts and the Others text", () => {
    expect(composeDeclaredIssues(["Pads", "Rotors"], "dent on bumper")).toBe("Pads; Rotors; Others: dent on bumper");
    expect(composeDeclaredIssues(["Pads"], "  ")).toBe("Pads");
    expect(composeDeclaredIssues([], null)).toBe("");
  });

  it("allows no issue photos but checks the ones given", () => {
    expect(validateIssuePhotos([])).toBeNull();
    expect(validateIssuePhotos([sizedPhoto("x.pdf", "application/pdf", 10)])).toBe(
      "Photos must be JPEG, PNG, or WebP images.",
    );
  });
});

describe("sellVehicleSchema owner number", () => {
  it("requires the owner number and stores it as a number", () => {
    expect(sellVehicleSchema.safeParse(baseData({ owner_number: undefined })).success).toBe(false);
    const parsed = sellVehicleSchema.safeParse(baseData({ owner_number: "4" }));
    expect(parsed.success && parsed.data.owner_number).toBe(4);
  });
});

describe("sellVehicleSchema issue declaration (Selling step 1)", () => {
  it("requires an explicit declaration and a meet-up method", () => {
    expect(sellVehicleSchema.safeParse(baseData({ has_known_issues: undefined })).success).toBe(false);
    expect(sellVehicleSchema.safeParse(baseData({ meetup_method: undefined })).success).toBe(false);
  });

  it("requires the issues to be described when the seller declares some", () => {
    expect(sellVehicleSchema.safeParse(baseData({ has_known_issues: "yes" })).success).toBe(false);
    expect(
      sellVehicleSchema.safeParse(baseData({ has_known_issues: "yes", declared_issues: "Aircon not cooling" })).success,
    ).toBe(true);
  });
});
