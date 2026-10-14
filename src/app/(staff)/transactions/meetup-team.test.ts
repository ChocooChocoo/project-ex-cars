import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, notify, db } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: reads answer with the row (and count) set for
  // the table, writes are recorded.
  const rows: Record<string, unknown> = {};
  const counts: Record<string, number> = {};
  const writes: { table: string; op: string; payload: Record<string, unknown> }[] = [];
  const workers: { account_id: string; role: string }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, count: counts[table] ?? 0, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "not", "order", "limit"]) builder[step] = () => builder;
    for (const op of ["insert", "upsert", "update"]) {
      builder[op] = (payload: Record<string, unknown>) => {
        writes.push({ table, op, payload });
        return builder;
      };
    }
    builder.maybeSingle = answer;
    builder.single = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  const rpc = () => Promise.resolve({ data: workers, error: null });
  return {
    getUser: vi.fn(),
    getCurrentRole: vi.fn(),
    notify: vi.fn(),
    db: { rows, counts, writes, workers, from, rpc },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/auth/audit", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/transactions/buy-flow-server", () => ({
  finalizeBuySale: vi.fn(),
  recordStandingEvent: vi.fn(),
  releaseVisitSlots: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser }, from: db.from, rpc: db.rpc })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import { receiveFieldCase } from "@/app/(staff)/field-cases/delivery-actions";

import { transitionTransaction } from "./actions";
import { createMeetupFieldCase } from "./delivery-actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const informantId = "33333333-3333-4333-8333-333333333333";
const mechanicId = "44444444-4444-4444-8444-444444444444";
const fieldCaseId = "55555555-5555-4555-8555-555555555555";

const team = { informant_id: informantId, mechanic_id: mechanicId };
const meetupCase = () => db.writes.find((write) => write.table === "field_cases" && write.op === "insert")?.payload;

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  for (const table of Object.keys(db.counts)) delete db.counts[table];
  db.writes.length = 0;
  db.workers.length = 0;
  db.workers.push(
    { account_id: informantId, role: "confidential_informant" },
    { account_id: mechanicId, role: "mechanic" },
  );
  getUser.mockResolvedValue({ data: { user: { id: userId } } });
  getCurrentRole.mockResolvedValue("sales_manager");
  db.rows.viewing_arrangements = { schedule: "2033-03-08T02:00:00.000Z", location: "SM Calamba parking, Laguna" };
});

describe("approving a cash Meet Halfway request", () => {
  function approve(fields: Record<string, string> = {}) {
    const fd = new FormData();
    fd.set("id", transactionId);
    fd.set("to_state", "approved");
    for (const [key, value] of Object.entries(fields)) fd.set(key, value);
    return transitionTransaction(fd);
  }

  beforeEach(() => {
    db.rows.transactions = {
      id: transactionId,
      current_state: "under_review",
      transaction_kind: "buy",
      vehicle_id: "car-1",
      customer_id: "buyer-1",
      flow_status: "pending_sm_approval",
      purchase_details: { payment_method: "cash", arrangement_kind: "meetup" },
    };
    db.counts.transaction_documents = 2;
  });

  it.each<Record<string, string>>([
    {},
    { informant_id: informantId },
    { mechanic_id: mechanicId },
  ])("is refused without a Confidential Informant and a Mechanic (%o)", async (fields) => {
    await expect(approve(fields)).resolves.toEqual({
      error: "Choose a Confidential Informant and a Mechanic before approving.",
    });
    expect(db.writes).toEqual([]);
  });

  it("is refused when the chosen Mechanic is not an active Mechanic", async () => {
    db.workers.pop();

    await expect(approve(team)).resolves.toEqual({ error: "Choose an active Mechanic." });
    expect(db.writes).toEqual([]);
  });

  it("creates the meet-up field case for the chosen team and tells them", async () => {
    await expect(approve(team)).resolves.toEqual({ success: true });

    expect(meetupCase()).toMatchObject({
      transaction_id: transactionId,
      case_kind: "buyer_meetup",
      assigned_confidential_informant: informantId,
      mechanic_id: mechanicId,
      schedule: "2033-03-08T02:00:00.000Z",
      location: "SM Calamba parking, Laguna",
      state: "assigned",
    });
    for (const worker of [informantId, mechanicId]) {
      expect(notify).toHaveBeenCalledWith(
        expect.anything(),
        { userId: worker },
        expect.objectContaining({ title: "You have a client to meet halfway" }),
      );
    }
  });
});

describe("assigning the team of a financed meet-up", () => {
  function assign(fields: Record<string, string> = team) {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    for (const [key, value] of Object.entries(fields)) fd.set(key, value);
    return createMeetupFieldCase(fd);
  }

  const request = (contractState: string | null) => {
    db.rows.transactions = {
      id: transactionId,
      customer_id: "buyer-1",
      vehicle_id: "car-1",
      current_state: "approved",
      transaction_kind: "buy",
      purchase_details: { payment_method: "financing", arrangement_kind: "meetup" },
      sale_handovers: contractState ? { contract_state: contractState } : null,
    };
  };

  it("waits for the Head Accountant to approve the contract", async () => {
    request("pending_approval");

    await expect(assign()).resolves.toEqual({ error: "The Head Accountant must approve the contract first." });
    expect(meetupCase()).toBeUndefined();
  });

  it("waits for the buyer to book the meet-up", async () => {
    request("approved");
    db.rows.viewing_arrangements = null;

    await expect(assign()).resolves.toEqual({ error: "The buyer has not booked the meet-up yet." });
  });

  it("needs both a Confidential Informant and a Mechanic", async () => {
    request("approved");

    await expect(assign({ informant_id: informantId })).resolves.toEqual({ error: "Choose a Mechanic." });
  });

  it("creates the case once the contract is approved and the meet-up is booked", async () => {
    request("approved");

    await expect(assign()).resolves.toEqual({ success: true });
    expect(meetupCase()).toMatchObject({ case_kind: "buyer_meetup", mechanic_id: mechanicId });
  });

  it("refuses a second case", async () => {
    request("approved");
    db.rows.field_cases = { id: fieldCaseId };

    await expect(assign()).resolves.toEqual({ error: "The meet-up team is already assigned." });
  });
});

describe("Mark as Sold on a financed meet-up", () => {
  it("asks for no payment record: nothing is paid before the account opens", async () => {
    db.rows.transactions = {
      current_state: "approved",
      transaction_kind: "buy",
      vehicle_id: "car-1",
      customer_id: "buyer-1",
      flow_status: "financing_active",
      purchase_details: { payment_method: "financing", arrangement_kind: "meetup" },
    };
    db.counts.transaction_documents = 2;
    db.counts.payment_records = 0;
    db.rows.sale_handovers = {
      papers_status: "handed_over",
      contract_state: "signed",
      ci_copy_at: "2033-03-08T03:00:00.000Z",
    };
    const fd = new FormData();
    fd.set("id", transactionId);
    fd.set("to_state", "completed");

    await expect(transitionTransaction(fd)).resolves.toEqual({ success: true });
  });
});

describe("receiveFieldCase", () => {
  function receive() {
    const fd = new FormData();
    fd.set("field_case_id", fieldCaseId);
    return receiveFieldCase(fd);
  }
  const fieldCase = (overrides: Record<string, unknown> = {}) => {
    db.rows.field_cases = {
      id: fieldCaseId,
      transaction_id: transactionId,
      case_kind: "buyer_meetup",
      state: "assigned",
      assigned_confidential_informant: informantId,
      mechanic_id: userId,
      ...overrides,
    };
  };
  const received = () => db.writes.find((write) => write.table === "field_cases")?.payload;

  it("records the Mechanic's receipt under the Mechanic", async () => {
    getCurrentRole.mockResolvedValue("mechanic");
    fieldCase();

    await expect(receive()).resolves.toEqual({ success: true });
    expect(received()).toEqual({ mechanic_received_at: expect.any(String) });
  });

  it("records the Confidential Informant's receipt under the Confidential Informant", async () => {
    getCurrentRole.mockResolvedValue("confidential_informant");
    fieldCase({ assigned_confidential_informant: userId, mechanic_id: mechanicId });

    await expect(receive()).resolves.toEqual({ success: true });
    expect(received()).toEqual({ ci_received_at: expect.any(String) });
  });

  it("refuses someone who is not on the case", async () => {
    getCurrentRole.mockResolvedValue("mechanic");
    fieldCase({ mechanic_id: mechanicId });

    await expect(receive()).resolves.toEqual({ error: "Only the team assigned to this field case can receive it." });
    expect(received()).toBeUndefined();
  });
});
