import { beforeEach, describe, expect, it, vi } from "vitest";

const notify = vi.fn();
vi.mock("@/lib/notifications/notify", () => ({ notify: (...args: unknown[]) => notify(...args) }));

import { notifyInformantIfPaidInFull } from "./buy-flow-server";

// Answers each table with its rows; every chained filter returns the same builder.
function adminWith(rows: Record<string, unknown>) {
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "in", "neq"]) builder[step] = () => builder;
    builder.maybeSingle = () => Promise.resolve({ data: rows[table] ?? null });
    // biome-ignore lint/suspicious/noThenProperty: Supabase queries are awaitable.
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: rows[table] ?? null }).then(resolve);
    return builder;
  };
  return { from } as never;
}

const sale = (paid: number, method = "bank_transfer") => ({
  transactions: {
    purchase_details: { payment_method: method, final_price: 1_000_000 },
    payment_records: [{ payment_kind: "balance", amount: paid, verified_by: "ha", rejected_at: null }],
  },
  field_cases: [{ assigned_confidential_informant: "ci-1" }],
});

beforeEach(() => notify.mockClear());

describe("notifyInformantIfPaidInFull (T10)", () => {
  it("tells the assigned Confidential Informant once the full price is verified", async () => {
    await notifyInformantIfPaidInFull(adminWith(sale(1_000_000)), "tx-1");
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][1]).toEqual({ userId: "ci-1" });
  });

  it("stays quiet while part of the price is unverified", async () => {
    await notifyInformantIfPaidInFull(adminWith(sale(999_000)), "tx-1");
    expect(notify).not.toHaveBeenCalled();
  });

  it("does nothing for a financed sale", async () => {
    await notifyInformantIfPaidInFull(adminWith(sale(1_000_000, "financing")), "tx-1");
    expect(notify).not.toHaveBeenCalled();
  });
});
