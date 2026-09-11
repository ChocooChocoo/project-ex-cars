import { describe, expect, it } from "vitest";

import { buildTransactionRows } from "./transactions-data";

const openedAt = "2026-09-01T12:00:00.000Z";

function row(overrides: Record<string, unknown>) {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    transaction_kind: "buy",
    current_state: "pending",
    opened_at: openedAt,
    vehicles: null,
    ...overrides,
  };
}

describe("buildTransactionRows", () => {
  it("keeps the kind as the primary label but uses the reference id beneath it", () => {
    const [request] = buildTransactionRows([row({ transaction_kind: "request_a_car" })]);

    expect(request.vehicleLabel).toBe("Request a Car");
    expect(request.subLabel).toBe("#11111111");
    expect(request.subLabel).not.toBe(request.vehicleLabel);
  });

  it("does not repeat the kind label for a sell with no linked vehicle", () => {
    const [sell] = buildTransactionRows([row({ transaction_kind: "sell" })]);

    expect(sell.vehicleLabel).toBe("Sell");
    expect(sell.subLabel).toBe("#11111111");
    expect(sell.subLabel).not.toBe(sell.vehicleLabel);
  });

  it("shows the vehicle and its stock code when a vehicle is linked", () => {
    const [buy] = buildTransactionRows([
      row({
        vehicles: { make: "Toyota", model: "Vios", year: 2020, stock_code: "GCE-1042" },
      }),
    ]);

    expect(buy.vehicleLabel).toBe("Toyota Vios (2020)");
    expect(buy.subLabel).toBe("Stock GCE-1042");
  });

  it("never renders the string 'undefined' for a joined but empty vehicle row", () => {
    const [buy] = buildTransactionRows([
      row({ vehicles: { make: null, model: null, year: null, stock_code: null } }),
    ]);

    expect(buy.vehicleLabel).toBe("Buy");
    expect(buy.vehicleLabel).not.toContain("undefined");
    expect(buy.subLabel).toBe("#11111111");
  });

  it("keeps the opened date and sort timestamp derived from opened_at", () => {
    const [buy] = buildTransactionRows([row({})]);

    expect(buy.openedAt).toBe("01 Sep 2026");
    expect(buy.openedTimestamp).toBe(new Date(openedAt).getTime());
    expect(buy.status).toBe("pending");
  });
});
