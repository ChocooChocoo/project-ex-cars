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
    condition: "Good",
    offered_amount: 450000,
    has_known_issues: "no",
    meetup_method: "gce_visit",
    owner_number: "1",
    papers_checklist: {
      official_receipt: "has",
      certificate_of_registration: "has",
      deed_of_sale: "has",
    },
    signed_id_copies: true,
    ...overrides,
  };
}

function getVisibleOption(label: string): HTMLElement {
  const candidates = screen.getAllByText(label);
  const visible = candidates.find((el) => el.closest('[data-slot="select-item"]') !== null);
  return (visible ?? candidates[0]) as HTMLElement;
}

describe("T12 sellVehicleSchema year", () => {
  it("rejects negative, decimal, too old and future years", () => {
    const next = new Date().getFullYear() + 2;
    for (const year of [-2020, 2020.5, 1979, next, "", "abc"]) {
      expect(sellVehicleSchema.safeParse(baseData({ year })).success).toBe(false);
    }
  });

  it("accepts a whole year typed as text", () => {
    const parsed = sellVehicleSchema.safeParse(baseData({ year: "2020" }));
    expect(parsed.success && parsed.data.year).toBe(2020);
  });
});

describe("T12 sellVehicleSchema meet-up point", () => {
  it("requires the map point for Meet Halfway only", () => {
    expect(sellVehicleSchema.safeParse(baseData({ meetup_method: "meet_halfway" })).success).toBe(false);
    expect(
      sellVehicleSchema.safeParse(baseData({ meetup_method: "meet_halfway", meetup_lat: "14.3", meetup_lng: "121.0" }))
        .success,
    ).toBe(true);
    expect(sellVehicleSchema.safeParse(baseData({ meetup_method: "gce_visit" })).success).toBe(true);
  });

  it("rejects a point outside the valid range", () => {
    expect(
      sellVehicleSchema.safeParse(baseData({ meetup_method: "meet_halfway", meetup_lat: 95, meetup_lng: 121 })).success,
    ).toBe(false);
  });

  it("keeps the meet-up pin inside CALABARZON (SH-14)", () => {
    for (const [meetup_lat, meetup_lng] of [
      [15.5, 121],
      [10.3, 123.9],
      [51.5, -0.12],
    ]) {
      const parsed = sellVehicleSchema.safeParse(baseData({ meetup_method: "meet_halfway", meetup_lat, meetup_lng }));
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe("Meet-ups must be inside CALABARZON.");
    }
    // GCE's office and a Dasmariñas halfway point are fine.
    for (const [meetup_lat, meetup_lng] of [
      [14.32856, 120.957],
      [14.33, 120.94],
    ]) {
      expect(
        sellVehicleSchema.safeParse(baseData({ meetup_method: "meet_halfway", meetup_lat, meetup_lng })).success,
      ).toBe(true);
    }
  });

  it("accepts the composed meet-up address, and does not require it (BH-8)", () => {
    const base = { meetup_method: "meet_halfway", meetup_lat: 14.33, meetup_lng: 120.94 };
    expect(sellVehicleSchema.safeParse(baseData(base)).success).toBe(true);
    expect(
      sellVehicleSchema.safeParse(baseData({ ...base, meetup_address: "Bagong Bayan, Dasmariñas, Cavite, Calabarzon" }))
        .success,
    ).toBe(true);
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

  it("rejects files larger than 2 MB", () => {
    expect(validateSellPhotos([sizedPhoto("big.jpg", "image/jpeg", 3 * 1024 * 1024)])).toBe(
      "Each photo must be 2 MB or smaller.",
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
    expect(screen.getByRole("spinbutton", { name: /^Year/ })).toBeInTheDocument();
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

describe("SellVehicleForm year", () => {
  it("blocks the keys that make a negative or decimal year", () => {
    render(<SellVehicleForm />);
    const year = screen.getByRole("spinbutton", { name: /^Year/ });
    for (const key of ["-", ".", "e", "+"]) {
      expect(fireEvent.keyDown(year, { key })).toBe(false);
    }
    expect(fireEvent.keyDown(year, { key: "2" })).toBe(true);
  });
});

describe("SellVehicleForm condition", () => {
  it("offers Like New, Good and Fair with their descriptions", async () => {
    render(<SellVehicleForm />);
    fireEvent.click(screen.getByRole("combobox", { name: /^Condition/ }));
    await waitFor(() => expect(screen.getAllByText("Like New").length).toBeGreaterThanOrEqual(1));
    expect(getVisibleOption("Good")).toBeInTheDocument();
    expect(getVisibleOption("Fair")).toBeInTheDocument();
    expect(screen.getByText("Barely used, no visible wear.")).toBeInTheDocument();
    expect(screen.queryByText("Brand New")).not.toBeInTheDocument();
    expect(screen.queryByText("Second Hand")).not.toBeInTheDocument();
  });

  it("stores the three conditions as written and rejects the old terms", () => {
    for (const condition of ["Like New", "Good", "Fair"]) {
      const parsed = sellVehicleSchema.safeParse(baseData({ condition }));
      expect(parsed.success && parsed.data.condition).toBe(condition);
    }
    for (const condition of ["Brand New", "Second Hand", ""]) {
      expect(sellVehicleSchema.safeParse(baseData({ condition })).success).toBe(false);
    }
  });
});

describe("SellVehicleForm papers checklist (SN-13)", () => {
  // Radix renders each answer twice (a hidden native option for form submission plus the visible item); only the
  // visible item carries data-slot="select-item".
  function visibleAnswers(): string[] {
    return Array.from(document.querySelectorAll('[data-slot="select-item"]')).map((el) => el.textContent ?? "");
  }

  it("asks the three papers as has / does not have / expired instead of uploads", async () => {
    render(<SellVehicleForm />);

    expect(
      screen.getByText(
        "GCE respects the privacy of your vehicle papers. Answer this checklist now and bring the originals to the meet-up.",
      ),
    ).toBeInTheDocument();
    for (const label of ["Official Receipt (OR) *", "Certificate of Registration (CR) *", "Deed of Sale *"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByLabelText("Official Receipt (OR) *"));
    await waitFor(() => expect(visibleAnswers()).toEqual(["I have it", "I don't have it", "It is expired"]));
  });

  it("offers an expired answer for the deed of sale too (notes line 115)", async () => {
    render(<SellVehicleForm />);

    fireEvent.click(screen.getByLabelText("Deed of Sale *"));

    await waitFor(() => expect(visibleAnswers()).toEqual(["I have it", "I don't have it", "It is expired"]));
  });

  it("carries the answers into the form state, so submitting is not blocked by the checklist", async () => {
    render(<SellVehicleForm />);
    const answer = async (label: string) => {
      fireEvent.click(screen.getByLabelText(label));
      await waitFor(() => expect(visibleAnswers().length).toBeGreaterThan(0), { timeout: 5000 });
      const item = Array.from(document.querySelectorAll('[data-slot="select-item"]')).find(
        (el) => el.textContent === "I have it",
      ) as HTMLElement;
      fireEvent.click(item);
    };
    fireEvent.submit(screen.getByRole("button", { name: "Submit Vehicle" }).closest("form") as HTMLFormElement);
    expect(
      await screen.findByText(
        "Answer the papers checklist for the OR, the CR and the deed of sale.",
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();

    for (const label of ["Official Receipt (OR) *", "Certificate of Registration (CR) *", "Deed of Sale *"]) {
      await answer(label);
    }
    await waitFor(
      () =>
        expect(screen.queryByText("Answer the papers checklist for the OR, the CR and the deed of sale.")).toBeNull(),
      { timeout: 5000 },
    );
  }, 20_000);

  it("keeps one upload slot per valid ID, front and back", () => {
    render(<SellVehicleForm />);

    expect(screen.getByText("Valid ID #1 *")).toBeInTheDocument();
    expect(screen.getByText("Valid ID #2 *")).toBeInTheDocument();
    expect(screen.getByLabelText("Vehicle photos")).toBeInTheDocument();
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
