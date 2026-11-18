import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { api, search } = vi.hoisted(() => ({ api: vi.fn(), search: { value: "" } }));
vi.mock("@/components/auth/session-provider", () => ({ useRequireRole: () => true }));
vi.mock("@/lib/routing/use-query", () => ({ useQuery: () => new URLSearchParams(search.value) }));
vi.mock("@/lib/api/client", () => ({ browserApi: api }));
vi.mock("./_components/recent-transactions-table/table", () => ({ RecentTransactionsTable: () => null }));
vi.mock("./_components/transactions-kpi-strip", () => ({
  TransactionsKpiStrip: ({ data }: { data: { label: string }[] }) => (
    <div>
      {data.map((item) => (
        <span key={item.label}>{item.label}</span>
      ))}
    </div>
  ),
}));

import TransactionsPage from "./page";

beforeEach(() => vi.clearAllMocks());

// Phase 5: Laravel applies the Sales Manager's buy-only rule and the ?state= filter; the page passes the filter on.
it("passes the state filter to Laravel and hides the Sell KPI for the Sales Manager", async () => {
  search.value = "?state=under_review";
  api.mockResolvedValue({ role: "sales_manager", transactions: [] });
  render(<TransactionsPage />);
  expect(await screen.findByText("Manage buying transactions.")).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith("GET", "/api/v1/staff/transactions?state=under_review");
  expect(screen.queryByText("Sell")).not.toBeInTheDocument();
});

it("keeps other roles' mixed transaction list", async () => {
  search.value = "";
  api.mockResolvedValue({ role: "ceo", transactions: [] });
  render(<TransactionsPage />);
  expect(await screen.findByText("Sell")).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith("GET", "/api/v1/staff/transactions");
});
