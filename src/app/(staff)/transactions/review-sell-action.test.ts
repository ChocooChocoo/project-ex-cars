import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authGetUser,
  getCurrentRole,
  serverFrom,
  adminFrom,
  logAuditEvent,
  sellDetailsUpdate,
  transactionUpdate,
  statusInsert,
} = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  getCurrentRole: vi.fn(),
  serverFrom: vi.fn(),
  adminFrom: vi.fn(),
  logAuditEvent: vi.fn(),
  sellDetailsUpdate: vi.fn(),
  transactionUpdate: vi.fn(),
  statusInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/auth/audit", () => ({ logAuditEvent }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: authGetUser }, from: serverFrom })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: adminFrom })) }));

import { reviewSellTransaction } from "./actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";

function reviewForm() {
  const form = new FormData();
  form.set("transaction_id", transactionId);
  form.set("valuation_amount", "1250000");
  form.set("decision", "accepted");
  form.set("review_notes", "Ready for CEO approval.");
  return form;
}

describe("reviewSellTransaction parsed payload regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    getCurrentRole.mockResolvedValue("ceo");
    logAuditEvent.mockResolvedValue(undefined);
    serverFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { current_state: "under_review" }, error: null }),
        })),
      })),
    });
    sellDetailsUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    transactionUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    statusInsert.mockResolvedValue({ error: null });
    adminFrom.mockImplementation((table: string) => {
      if (table === "sell_details") return { update: sellDetailsUpdate };
      if (table === "transactions") return { update: transactionUpdate };
      if (table === "transaction_status_history") return { insert: statusInsert };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("uses validated transaction review fields for every write", async () => {
    const result = await reviewSellTransaction(reviewForm());

    expect(result).toEqual({ success: true });
    expect(sellDetailsUpdate).toHaveBeenCalledWith({
      valuation_amount: 1250000,
      decision: "accepted",
      review_notes: "Ready for CEO approval.",
      decision_maker_id: userId,
      decision_date: expect.any(String),
    });
    expect(transactionUpdate).toHaveBeenCalledWith({
      current_state: "approved",
      completed_at: null,
    });
    expect(statusInsert).toHaveBeenCalledWith({
      transaction_id: transactionId,
      from_state: "under_review",
      to_state: "approved",
      actor_id: userId,
      reason: "Sell review: accepted. Ready for CEO approval.",
    });
  });
});
