import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { advanceDisbursement } from "@/app/(staff)/finance/actions";

import { type DisbursementRow, FinanceClient, type FinancialEntryRow, getFinanceSummary } from "./finance-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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

  it("lets finance roles approve a draft disbursement", () => {
    render(
      <FinanceClient
        entries={[]}
        disbursements={[
          {
            id: "d2",
            title: "Car purchase fund",
            amount_cents: 48_000_000,
            purpose: "seller payment",
            status: "draft",
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
    openDisbursements();
    // T03 HA4: actions live in the request's detail view.
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Open Car purchase fund/ }));
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
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

function openDisbursements() {
  const tab = screen.getByRole("tab", { name: /Disbursements/ });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
}

function disbursement(overrides: Partial<DisbursementRow> = {}): DisbursementRow {
  return {
    id: "d1",
    title: "Reconditioning fund",
    amount_cents: 1_500_000,
    purpose: "short",
    status: "draft",
    notes: null,
    requested_by: "u1",
    purchase_transaction_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const financeProps = {
  purchaseTransactions: [],
  canRecord: true,
  canVerify: true,
  canRequest: true,
  canAdvance: true,
  canRequestPurchaseFunds: true,
  isInformant: false,
};

describe("Finance tables (T03 HA4, HA5)", () => {
  beforeEach(() => vi.mocked(advanceDisbursement).mockReset());

  it("shows 10 ledger entries per page", () => {
    const entries = Array.from({ length: 12 }, (_, i) => entry({ id: `e${i}`, description: `Entry ${i + 1}` }));
    render(<FinanceClient entries={entries} disbursements={[]} {...financeProps} />);

    expect(screen.getByText("Entry 10")).toBeInTheDocument();
    expect(screen.queryByText("Entry 11")).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("opens a disbursement with its full purpose", () => {
    const purpose = `${"Replace the timing belt, water pump and both front tyres before listing. ".repeat(6)}End.`;
    render(<FinanceClient entries={[]} disbursements={[disbursement({ purpose })]} {...financeProps} />);
    openDisbursements();

    fireEvent.click(screen.getByRole("button", { name: /Open Reconditioning fund/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(purpose);
  });

  it("needs a reason to reject, and sends it with the rejection", async () => {
    vi.mocked(advanceDisbursement).mockResolvedValue({ success: true } as never);
    render(<FinanceClient entries={[]} disbursements={[disbursement()]} {...financeProps} />);
    openDisbursements();
    fireEvent.click(screen.getByRole("button", { name: /Open Reconditioning fund/ }));

    const reject = screen.getByRole("button", { name: "Reject" });
    expect(reject).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Reason for rejecting"), { target: { value: "No quotation attached" } });
    expect(reject).toBeEnabled();
    fireEvent.click(reject);

    await waitFor(() => expect(advanceDisbursement).toHaveBeenCalled());
    const form = vi.mocked(advanceDisbursement).mock.calls[0][0] as FormData;
    expect(form.get("event_kind")).toBe("rejected");
    expect(form.get("notes")).toBe("No quotation attached");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Disbursement rejected."));
  });

  it("shows 10 disbursement requests per page", () => {
    const rows = Array.from({ length: 11 }, (_, i) => disbursement({ id: `d${i}`, title: `Request ${i + 1}` }));
    render(<FinanceClient entries={[]} disbursements={rows} {...financeProps} />);
    openDisbursements();

    expect(screen.getByText("Request 10")).toBeInTheDocument();
    expect(screen.queryByText("Request 11")).not.toBeInTheDocument();
  });
});
