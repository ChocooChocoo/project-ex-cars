import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, notify, db } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: every read of a table answers with the row
  // set for it, and every write is recorded.
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "order", "limit"]) builder[step] = () => builder;
    for (const op of ["insert", "upsert", "update"]) {
      builder[op] = (payload: Record<string, unknown>) => {
        writes.push({ table, op, payload });
        return builder;
      };
    }
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return { getUser: vi.fn(), getCurrentRole: vi.fn(), notify: vi.fn(), db: { rows, writes, from } };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from })) }));

import {
  approvePapersRelease,
  handPapersToBuyer,
  receivePapers,
  releasePapersToCi,
  requestPapersRelease,
} from "./handover-actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const CI_ONLY = "Only the Confidential Informant handles the vehicle papers.";

function form() {
  const fd = new FormData();
  fd.set("transaction_id", transactionId);
  return fd;
}

function sale(arrangement: string, overrides: Record<string, unknown> = {}) {
  db.rows.transactions = {
    id: transactionId,
    customer_id: "buyer-1",
    current_state: "approved",
    transaction_kind: "buy",
    purchase_details: { arrangement_kind: arrangement, payment_method: "cash" },
    payment_records: [{ verified_by: "accountant-1" }],
    ...overrides,
  };
}

const papers = (status: string | null) => {
  db.rows.sale_handovers = status ? { papers_status: status } : null;
};

const papersWrite = () => db.writes.find((write) => write.table === "sale_handovers")?.payload;

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: userId } } });
  getCurrentRole.mockResolvedValue("sales_manager");
  db.rows.field_cases = { id: "case-1", assigned_confidential_informant: userId };
});

describe("papers release at a GCE visit", () => {
  it("lets the Sales Manager request the papers once the payment is checked", async () => {
    sale("gce_visit");

    await expect(requestPapersRelease(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ transaction_id: transactionId, papers_status: "requested" });
    expect(notify).toHaveBeenCalledWith(expect.anything(), { role: "confidential_informant" }, expect.anything());
  });

  it("refuses the request before the Head Accountant has checked the payment", async () => {
    sale("gce_visit", { payment_records: [{ verified_by: null }] });

    await expect(requestPapersRelease(form())).resolves.toEqual({
      error: "The Head Accountant must check the payment before the papers are requested.",
    });
    expect(papersWrite()).toBeUndefined();
  });

  it("refuses a second request while one is open", async () => {
    sale("gce_visit");
    papers("requested");

    await expect(requestPapersRelease(form())).resolves.toEqual({ error: "The papers were already requested." });
  });

  it("sends a meet-up or delivery to the field case instead", async () => {
    sale("delivery");

    await expect(requestPapersRelease(form())).resolves.toEqual({
      error: "For a meet-up or a delivery, the Confidential Informant releases the papers on the field case.",
    });
  });

  it("lets only the Confidential Informant approve and hand the papers over", async () => {
    sale("gce_visit");
    papers("requested");

    await expect(approvePapersRelease(form())).resolves.toEqual({ error: CI_ONLY });

    getCurrentRole.mockResolvedValue("confidential_informant");
    await expect(approvePapersRelease(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ papers_status: "handed_over", papers_ci_id: userId });
  });

  it("refuses an approval nobody asked for", async () => {
    getCurrentRole.mockResolvedValue("confidential_informant");
    sale("gce_visit");
    papers(null);

    await expect(approvePapersRelease(form())).resolves.toEqual({ error: "No papers release is waiting." });
  });

  it("lets the Sales Manager receive the papers only after the CI handed them over", async () => {
    sale("gce_visit");
    papers("requested");
    await expect(receivePapers(form())).resolves.toEqual({
      error: "The Confidential Informant has not handed the papers over yet.",
    });

    papers("handed_over");
    await expect(receivePapers(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ papers_status: "received" });
  });
});

describe("papers at a meet-up or delivery", () => {
  beforeEach(() => getCurrentRole.mockResolvedValue("confidential_informant"));

  it.each(["mechanic", "head_security", "sales_manager"])("refuses the %s", async (role) => {
    getCurrentRole.mockResolvedValue(role);
    sale("delivery");

    await expect(releasePapersToCi(form())).resolves.toEqual({ error: CI_ONLY });
    await expect(handPapersToBuyer(form())).resolves.toEqual({ error: CI_ONLY });
    expect(papersWrite()).toBeUndefined();
  });

  it("refuses a Confidential Informant who is not assigned to the field case", async () => {
    sale("meetup");
    db.rows.field_cases = { id: "case-1", assigned_confidential_informant: "someone-else" };

    await expect(releasePapersToCi(form())).resolves.toEqual({
      error: "Only the Confidential Informant assigned to this field case can do this.",
    });
  });

  it("records the release under the assigned Confidential Informant", async () => {
    sale("delivery");

    await expect(releasePapersToCi(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ papers_status: "released_to_ci", papers_ci_id: userId });
  });

  it("hands the papers to the buyer only after they were released", async () => {
    sale("meetup");
    papers(null);
    await expect(handPapersToBuyer(form())).resolves.toEqual({ error: "Record the papers as released first." });

    papers("released_to_ci");
    await expect(handPapersToBuyer(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ papers_status: "handed_over" });
  });
});
