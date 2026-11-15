import { describe, expect, it } from "vitest";

import { markupFor } from "./financing";

describe("markupFor", () => {
  it("charges the car's own markup when it has one", () => {
    expect(markupFor({ financing_markup_pct: 12 }, 10)).toBe(12);
    // Supabase returns NUMERIC as a string.
    expect(markupFor({ financing_markup_pct: "7.5" }, 10)).toBe(7.5);
    expect(markupFor({ financing_markup_pct: 0 }, 10)).toBe(0);
  });

  it("falls back to the global markup when the car has none", () => {
    expect(markupFor({ financing_markup_pct: null }, 10)).toBe(10);
    expect(markupFor({ financing_markup_pct: undefined }, 10)).toBe(10);
    expect(markupFor({}, 10)).toBe(10);
    expect(markupFor(null, 10)).toBe(10);
    expect(markupFor(undefined, 10)).toBe(10);
  });

  it("falls back to the global markup when the car's value is unusable", () => {
    expect(markupFor({ financing_markup_pct: "not a number" }, 10)).toBe(10);
    expect(markupFor({ financing_markup_pct: -5 }, 10)).toBe(10);
  });
});
