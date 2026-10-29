import { beforeEach, describe, expect, it, vi } from "vitest";

const disbursementId = "11111111-1111-4111-8111-111111111111";
const vehicleUpdates: { row: Record<string, unknown>; filters: [string, unknown][] }[] = [];
let updatedVehicles: { id: string }[] = [];
let sellTx: Record<string, unknown> | null = null;
let requestStatus = "received";
let purchaseTransactionId: string | null = "tx-1";
const sessionWrites: string[] = [];

const { notify, moveSellTransaction, completePurchase, currentRole } = vi.hoisted(() => ({
  notify: vi.fn(),
  moveSellTransaction: vi.fn(async () => null),
  completePurchase: vi.fn(async () => ({ error: null as { message: string } | null })),
  currentRole: vi.fn(async () => "head_accountant"),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole: currentRole }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/transactions/sell-flow-server", () => ({
  loadSellTransaction: vi.fn(async () => sellTx),
  moveSellTransaction,
}));

// The session client only has to read the request and record the step.
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "22222222-2222-4222-8222-222222222222" } } }) },
    rpc: completePurchase,
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { status: requestStatus, purchase_transaction_id: purchaseTransactionId } }),
        }),
      }),
      update: () => ({
        eq: async () => {
          sessionWrites.push(table);
          return { error: null };
        },
      }),
      insert: async () => {
        sessionWrites.push(table);
        return { error: null };
      },
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
    requestStatus = "received";
    purchaseTransactionId = "tx-1";
    sessionWrites.length = 0;
    currentRole.mockResolvedValue("head_accountant");
    completePurchase.mockReset();
    completePurchase.mockResolvedValue({ error: null });
    moveSellTransaction.mockClear();
    sellTx = { id: "tx-1", vehicle_id: "veh-1", current_state: "approved", sell: { agreed_price: 450000 } };
  });

  it("delegates purchase payment and posting to one atomic database operation", async () => {
    await expect(advanceDisbursement(paidForm())).resolves.toEqual({ success: true });
    expect(completePurchase).toHaveBeenCalledWith("complete_purchase_disbursement", {
      p_disbursement_id: disbursementId,
      p_notes: null,
    });
    expect(moveSellTransaction).not.toHaveBeenCalled();
    expect(vehicleUpdates).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
    expect(sessionWrites).toEqual([]);
  });

  it("allows a paid purchase to be retried for recovery", async () => {
    requestStatus = "paid";
    await expect(advanceDisbursement(paidForm())).resolves.toEqual({ success: true });
    expect(completePurchase).toHaveBeenCalledTimes(1);
  });

  it("reports a rolled-back database operation without sending application notifications", async () => {
    completePurchase.mockResolvedValue({ error: { message: "Vehicle update failed" } });
    await expect(advanceDisbursement(paidForm())).resolves.toEqual({ error: "Vehicle update failed" });
    expect(notify).not.toHaveBeenCalled();
    expect(sessionWrites).toEqual([]);
  });

  it("rejects the CEO before invoking the purchase payment function", async () => {
    currentRole.mockResolvedValue("ceo");
    await expect(advanceDisbursement(paidForm())).resolves.toEqual({
      error: "Only the Head Accountant can approve or release car-purchase funds.",
    });
    expect(completePurchase).not.toHaveBeenCalled();
    expect(sessionWrites).toEqual([]);
  });

  it("preserves payment-only behavior for an ordinary disbursement", async () => {
    purchaseTransactionId = null;
    await expect(advanceDisbursement(paidForm())).resolves.toEqual({ success: true });
    expect(completePurchase).not.toHaveBeenCalled();
    expect(sessionWrites).toEqual(["disbursement_requests", "disbursement_events"]);
  });

  it("still refuses repeated paid events on ordinary disbursements", async () => {
    purchaseTransactionId = null;
    requestStatus = "paid";
    await expect(advanceDisbursement(paidForm())).resolves.toEqual({ error: "Cannot move from paid to paid." });
    expect(completePurchase).not.toHaveBeenCalled();
    expect(sessionWrites).toEqual([]);
  });
});
