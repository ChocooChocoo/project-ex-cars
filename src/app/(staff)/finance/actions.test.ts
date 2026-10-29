import { beforeEach, describe, expect, it, vi } from "vitest";

const disbursementId = "11111111-1111-4111-8111-111111111111";
const vehicleUpdates: { row: Record<string, unknown>; filters: [string, unknown][] }[] = [];
let updatedVehicles: { id: string }[] = [];
let sellTx: Record<string, unknown> | null = null;

const { notify, moveSellTransaction } = vi.hoisted(() => ({
  notify: vi.fn(),
  moveSellTransaction: vi.fn(async () => null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole: vi.fn(async () => "head_accountant") }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/transactions/sell-flow-server", () => ({
  loadSellTransaction: vi.fn(async () => sellTx),
  moveSellTransaction,
}));

// The session client only has to read the request and record the step.
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "22222222-2222-4222-8222-222222222222" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { status: "received", purchase_transaction_id: "tx-1" } }) }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
      insert: async () => ({ error: null }),
    }),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      update: (row: Record<string, unknown>) => {
        const entry = { row, filters: [] as [string, unknown][] };
        if (table === "vehicles") vehicleUpdates.push(entry);
        const chain = {
          eq: (column: string, value: unknown) => {
            entry.filters.push([column, value]);
            return chain;
          },
          select: async () => ({ data: updatedVehicles, error: null }),
        };
        return chain;
      },
    }),
  }),
}));

import { advanceDisbursement } from "./actions";

function paidForm() {
  const form = new FormData();
  form.set("disbursement_id", disbursementId);
  form.set("event_kind", "paid");
  return form;
}

describe("advanceDisbursement: seller paid", () => {
  beforeEach(() => {
    vehicleUpdates.length = 0;
    updatedVehicles = [{ id: "veh-1" }];
    notify.mockReset();
    moveSellTransaction.mockClear();
    sellTx = { id: "tx-1", vehicle_id: "veh-1", current_state: "approved", sell: { agreed_price: 450000 } };
  });

  it("completes the sell and sends its draft car to the posting queue", async () => {
    await expect(advanceDisbursement(paidForm())).resolves.toEqual({ success: true });

    expect(moveSellTransaction).toHaveBeenCalledWith(
      expect.anything(),
      sellTx,
      expect.any(String),
      { current_state: "completed" },
      expect.any(String),
    );
    expect(vehicleUpdates).toEqual([
      {
        row: { listing_state: "awaiting_price_approval" },
        filters: [
          ["id", "veh-1"],
          ["listing_state", "draft"],
        ],
      },
    ]);
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      { role: "marketing_specialist" },
      expect.objectContaining({ kind: "sell_vehicle_ready_to_post", transactionId: "tx-1" }),
    );
  });

  it("does not notify Marketing when the car already left draft", async () => {
    updatedVehicles = [];

    await advanceDisbursement(paidForm());

    expect(notify).not.toHaveBeenCalledWith(expect.anything(), { role: "marketing_specialist" }, expect.anything());
  });

  it("leaves the car alone when the sell is not at the approved step", async () => {
    sellTx = { ...sellTx, current_state: "completed" };

    await advanceDisbursement(paidForm());

    expect(vehicleUpdates).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });
});
