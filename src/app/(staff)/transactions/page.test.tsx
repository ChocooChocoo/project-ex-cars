import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { role, eq } = vi.hoisted(() => ({ role: vi.fn(), eq: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole: role }));
vi.mock("@/lib/auth/guards", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/notifications/actions", () => ({ checkAndNotifyOverdueReviews: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => {
    const builder = {
      select: () => builder,
      order: () => builder,
      eq: (key: string, value: string) => {
        eq(key, value);
        return builder;
      },
      // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [] }).then(resolve),
    };
    return { from: () => builder };
  },
}));
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

it("limits Sales Manager to buying transactions and hides Sell KPI", async () => {
  role.mockResolvedValue("sales_manager");
  render(await TransactionsPage({ searchParams: Promise.resolve({ state: "under_review" }) }));
  expect(eq).toHaveBeenCalledWith("transaction_kind", "buy");
  expect(eq).toHaveBeenCalledWith("current_state", "under_review");
  expect(screen.queryByText("Sell")).not.toBeInTheDocument();
  expect(screen.queryByText("Request")).not.toBeInTheDocument();
  expect(screen.getByText("Manage buying transactions.")).toBeInTheDocument();
});

it("keeps other roles' mixed transaction list", async () => {
  role.mockResolvedValue("ceo");
  render(await TransactionsPage({ searchParams: Promise.resolve({}) }));
  expect(eq).not.toHaveBeenCalledWith("transaction_kind", "buy");
  expect(screen.getByText("Sell")).toBeInTheDocument();
});
