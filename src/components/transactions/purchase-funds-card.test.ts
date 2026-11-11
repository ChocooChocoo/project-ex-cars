import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(staff)/field-cases/budget-actions", () => ({ recordBudgetReturn: vi.fn() }));
vi.mock("@/app/(staff)/finance/actions", () => ({ recordSellerPaid: vi.fn(), requestPurchaseFunds: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { purchaseExcessCents } from "./purchase-funds-card";

describe("purchaseExcessCents (T10)", () => {
  const fund = (status: string) => ({ status, amount_cents: 52_000_000 });

  it("is everything released while the seller is unpaid (the offer may still end)", () => {
    expect(purchaseExcessCents(fund("released"), 500_000, [{ amount: 3_000 }])).toBe(51_700_000);
  });

  it("is the travel left over after the seller is paid", () => {
    expect(purchaseExcessCents(fund("paid"), 500_000, [{ amount: 3_000 }])).toBe(1_700_000);
  });

  it("is the difference after a lower re-negotiated price", () => {
    expect(purchaseExcessCents(fund("paid"), 450_000, [])).toBe(7_000_000);
  });

  it("owes nothing before release", () => {
    expect(purchaseExcessCents(fund("submitted"), 500_000, [])).toBe(0);
    expect(purchaseExcessCents(null, 500_000, [])).toBe(0);
  });
});
