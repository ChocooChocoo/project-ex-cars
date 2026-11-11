import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, db, DeliveryCase, BuyerMeetupCase } = vi.hoisted(() => {
  const rows: Record<string, unknown> = {};
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "in", "order", "limit"]) builder[step] = () => builder;
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  return {
    getUser: vi.fn(),
    getCurrentRole: vi.fn(),
    db: { rows, from },
    DeliveryCase: vi.fn(),
    BuyerMeetupCase: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: db.from, storage: {} })) }));
vi.mock("@/lib/transactions/document-media", () => ({ withSignedTransactionDocumentUrls: vi.fn(async () => []) }));
vi.mock("./_components/delivery-case", () => ({ DeliveryCase }));
vi.mock("./_components/buyer-meetup-case", () => ({ BuyerMeetupCase }));
vi.mock("./_components/sell-meetup-case", () => ({ SellMeetupCase: vi.fn() }));
vi.mock("./_components/field-budget-card", () => ({ FieldBudgetCard: vi.fn() }));
vi.mock("./_components/field-expenses-card", () => ({ FieldExpensesCard: vi.fn() }));

import FieldCasePage from "./page";

const ciId = "11111111-1111-4111-8111-111111111111";
const caseId = "33333333-3333-4333-8333-333333333333";
const transactionId = "22222222-2222-4222-8222-222222222222";

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: caseId,
    transaction_id: transactionId,
    case_kind: "delivery",
    state: "in_progress",
    delivery_status: "dispatched",
    assigned_confidential_informant: null,
    mechanic_id: null,
    head_security_id: null,
    ...overrides,
  };
}

type Element = { type: unknown; props: Record<string, unknown> };

// T10: delivery and buyer meet-up pages wrap the case with its budget and expenses; return the case itself.
async function load() {
  const page = (await FieldCasePage({ params: Promise.resolve({ id: caseId }) })) as unknown as Element;
  if (page.type !== "div") return page;
  return (page.props.children as Element[])[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  getUser.mockResolvedValue({ data: { user: { id: ciId } } });
  getCurrentRole.mockResolvedValue("confidential_informant");
  db.rows.sale_handovers = null;
  db.rows.transactions = {
    id: transactionId,
    current_state: "approved",
    profiles: { full_name: "Buyer One", phone: "0917" },
    vehicles: { make: "Toyota", model: "Vios", year: 2024, stock_code: "STK-1" },
    purchase_details: { payment_method: "cash", arrangement_kind: "delivery" },
  };
});

describe("field case detail access", () => {
  it("lets an unassigned Confidential Informant read a delivery case without the team actions", async () => {
    db.rows.field_cases = caseRow({ assigned_confidential_informant: "another-ci" });

    const element = await load();

    expect(element.type).toBe(DeliveryCase);
    expect(element.props.member).toBeNull();
    expect(element.props.userRole).toBe("confidential_informant");
  });

  it("lets an unassigned Confidential Informant read a buyer meet-up with no way to record anything", async () => {
    db.rows.field_cases = caseRow({ case_kind: "buyer_meetup", mechanic_id: "another-mechanic" });

    const element = await load();

    expect(element.type).toBe(BuyerMeetupCase);
    expect(element.props.member).toBeNull();
    expect(element.props.canRecordPapers).toBe(false);
  });

  it("keeps the assigned Confidential Informant's team actions", async () => {
    db.rows.field_cases = caseRow({ assigned_confidential_informant: ciId });

    const element = await load();

    expect(element.type).toBe(DeliveryCase);
    expect(element.props.member).toBe("informant");
  });

  it("still redirects a Mechanic who is not on the case", async () => {
    getCurrentRole.mockResolvedValue("mechanic");
    db.rows.field_cases = caseRow({ mechanic_id: "another-mechanic" });

    await expect(load()).rejects.toThrow("redirect:/unauthorized");
  });

  it("does not open a seller meet-up (acquisition) to an unassigned Confidential Informant", async () => {
    db.rows.field_cases = caseRow({ case_kind: "acquisition", assigned_confidential_informant: "another-ci" });

    await expect(load()).rejects.toThrow("redirect:/unauthorized");
  });
});
