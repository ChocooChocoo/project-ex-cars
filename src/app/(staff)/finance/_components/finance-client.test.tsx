import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FinanceClient, type FinancialEntryRow, getFinanceSummary } from "./finance-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(staff)/finance/actions", () => ({
  advanceDisbursement: vi.fn(),
  createDisbursementRequest: vi.fn(),
  recordFinancialEntry: vi.fn(),
  requestPurchaseFunds: vi.fn(),
  verifyFinancialEntry: vi.fn(),
}));

function entry(overrides: Partial<FinancialEntryRow> = {}): FinancialEntryRow {
  return {
    id: "entry-1",
    entry_kind: "revenue",
    amount_cents: 10000,
    description: "Test entry",
    verified_by: null,
    recorded_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("getFinanceSummary", () => {
  it("sums revenue and expense from same entries array without second fetch", () => {
    const entries: FinancialEntryRow[] = [
      entry({ id: "1", entry_kind: "revenue", amount_cents: 50000 }),
      entry({ id: "2", entry_kind: "expense", amount_cents: 20000 }),
      entry({ id: "3", entry_kind: "revenue", amount_cents: 30000 }),
      entry({ id: "4", entry_kind: "disbursement", amount_cents: 10000 }),
    ];
    const summary = getFinanceSummary(entries);
    const expectedRevenue = entries.filter((e) => e.entry_kind === "revenue").reduce((s, e) => s + e.amount_cents, 0);
    const expectedExpense = entries.filter((e) => e.entry_kind === "expense").reduce((s, e) => s + e.amount_cents, 0);
    expect(summary.revenueTotal).toBe(expectedRevenue);
    expect(summary.expenseTotal).toBe(expectedExpense);
    expect(summary.netTotal).toBe(expectedRevenue - expectedExpense);
    expect(summary.count).toBe(entries.length);
  });

  it("handles empty entries", () => {
    const summary = getFinanceSummary([]);
    expect(summary.revenueTotal).toBe(0);
    expect(summary.expenseTotal).toBe(0);
    expect(summary.netTotal).toBe(0);
    expect(summary.count).toBe(0);
  });

  it("equals reduce on same entries for finance strip", () => {
    const entries = [
      entry({ entry_kind: "revenue", amount_cents: 12345 }),
      entry({ entry_kind: "expense", amount_cents: 5432 }),
    ];
    const summary = getFinanceSummary(entries);
    expect(summary.revenueTotal).toBe(
      entries.filter((e) => e.entry_kind === "revenue").reduce((sum, e) => sum + e.amount_cents, 0),
    );
    expect(summary.expenseTotal).toBe(
      entries.filter((e) => e.entry_kind === "expense").reduce((sum, e) => sum + e.amount_cents, 0),
    );
  });
});

describe("FinanceClient", () => {
  it("renders revenue, expense, and active disbursements cards for ceo", () => {
    const entries = [
      entry({ entry_kind: "revenue", amount_cents: 100000 }),
      entry({ entry_kind: "expense", amount_cents: 40000 }),
    ];
    render(
      <FinanceClient
        entries={entries}
        disbursements={[
          {
            id: "d1",
            title: "Req",
            amount_cents: 5000,
            purpose: "p",
            status: "submitted",
            notes: null,
            requested_by: "u1",
            purchase_transaction_id: null,
            created_at: new Date().toISOString(),
          },
        ]}
        purchaseTransactions={[]}
        canRecord
        canVerify
        canRequest
        canAdvance
        canRequestPurchaseFunds
        isInformant={false}
      />,
    );
    expect(screen.getAllByText("Revenue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getAllByText("Active Disbursements").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("Ledger")).toBeInTheDocument();
  });

  it("shows totals Cards + own disbursements with ledger collapsed for informant", () => {
    const entries = [
      entry({ entry_kind: "revenue", amount_cents: 10000 }),
      entry({ entry_kind: "expense", amount_cents: 2000 }),
    ];
    render(
      <FinanceClient
        entries={entries}
        disbursements={[
          {
            id: "d1",
            title: "My Req",
            amount_cents: 3000,
            purpose: "field",
            status: "draft",
            notes: null,
            requested_by: "u1",
            purchase_transaction_id: null,
            created_at: new Date().toISOString(),
          },
        ]}
        purchaseTransactions={[]}
        canRecord={false}
        canVerify={false}
        canRequest
        canAdvance={false}
        canRequestPurchaseFunds={false}
        isInformant
      />,
    );
    expect(screen.getAllByText("Revenue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/You are viewing your own disbursement requests/)).toBeInTheDocument();
    expect(screen.queryByText("Summary")).not.toBeInTheDocument();
    const details = screen.getByTestId("informant-ledger");
    expect(details).toBeInTheDocument();
    expect(details.hasAttribute("open")).toBe(false);
    expect(screen.getAllByText(/View full ledger/)[0]).toBeInTheDocument();
  });

  it("preserves canRecord/canVerify false banner and hides Verify for informant", () => {
    render(
      <FinanceClient
        entries={[entry({ description: "Needs verify", verified_by: null })]}
        disbursements={[]}
        purchaseTransactions={[]}
        canRecord={false}
        canVerify={false}
        canRequest
        canAdvance={false}
        canRequestPurchaseFunds={false}
        isInformant
      />,
    );
    expect(screen.getByText(/You are viewing your own disbursement requests/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record Entry" })).not.toBeInTheDocument();
  });

  it("finance-client informant cannot see Record button", () => {
    render(
      <FinanceClient
        entries={[entry()]}
        disbursements={[]}
        purchaseTransactions={[]}
        canRecord={false}
        canVerify={false}
        canRequest
        canAdvance={false}
        canRequestPurchaseFunds={false}
        isInformant
      />,
    );
    expect(screen.queryByRole("button", { name: "Record Entry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record/ })).not.toBeInTheDocument();
  });
});
