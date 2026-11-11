import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const notify = vi.fn();
vi.mock("@/lib/notifications/notify", () => ({ notify: (...args: unknown[]) => notify(...args) }));
vi.mock("@/lib/transactions/buy-flow-server", () => ({ notifyInformantIfPaidInFull: vi.fn() }));
vi.mock("@/lib/transactions/financing-server", () => ({ confirmInitialDownpaymentIfPaid: vi.fn() }));

import { markCheckoutPaid } from "./checkout-paid";

// The conditional update returns the rows it changed: the first caller gets them, a racing second gets none.
function adminWith(claims: unknown[][]) {
  const from = () => {
    const builder: Record<string, unknown> = {};
    for (const step of ["update", "eq", "is", "in"]) builder[step] = () => builder;
    builder.select = () => Promise.resolve({ data: claims.shift() ?? [], error: null });
    // biome-ignore lint/suspicious/noThenProperty: Supabase queries are awaitable.
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve);
    return builder;
  };
  return { from } as never;
}

describe("markCheckoutPaid", () => {
  it("notifies once when the webhook and Pay mark the same session", async () => {
    const row = { id: "p1", transaction_id: "t1", recorded_by: "u1", payment_kind: "downpayment", amount: 1000 };
    const admin = adminWith([[row], []]);
    await expect(markCheckoutPaid(admin, "cs_1", "pay_1")).resolves.toBe(true);
    await expect(markCheckoutPaid(admin, "cs_1", "pay_1")).resolves.toBe(false);
    expect(notify).toHaveBeenCalledTimes(2); // head accountant + sales manager, from the first call only
  });
});
