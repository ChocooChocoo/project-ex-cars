import { beforeEach, expect, it, vi } from "vitest";

const { guard, read, view } = vi.hoisted(() => ({ guard: vi.fn(), read: vi.fn(), view: vi.fn() }));
vi.mock("../../_lib/paper-access", () => ({
  PAPER_ROLES: ["ceo", "head_accountant", "sales_manager"],
  requirePaperReader: guard,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const builder = { select: () => builder, eq: () => builder, maybeSingle: read };
    return { from: () => builder };
  },
}));
vi.mock("../../_components/paper-document-view", () => ({ PaperDocumentView: view }));

import MissedPaymentPolicyPage from "./page";

beforeEach(() => vi.clearAllMocks());

it("guards the printable policy with the shared reader guard, for the staff roles and the buyer", async () => {
  read.mockResolvedValue({ data: { id: "tx" } });
  const element = await MissedPaymentPolicyPage({ params: Promise.resolve({ transactionId: "tx" }) });

  // T11: the guard also lets the buyer and the assigned CI open their own copy.
  expect(guard).toHaveBeenCalledWith("tx", ["ceo", "head_accountant", "sales_manager"]);
  expect(element.props.paper.title).toBe("MISSED PAYMENT POLICY");
  expect(element.props.paper.paragraphs.join("\n")).toContain("Four (4) consecutive missed monthly payments");
});

it("lets the staff roles the guard still allows through to the paper", async () => {
  read.mockResolvedValue({ data: { id: "tx" } });
  await MissedPaymentPolicyPage({ params: Promise.resolve({ transactionId: "tx" }) });

  const allowed = vi.mocked(guard).mock.calls[0]?.[1] as string[];
  expect(allowed).toEqual(expect.arrayContaining(["ceo", "head_accountant", "sales_manager"]));
});

it("404s for an unknown transaction", async () => {
  read.mockResolvedValue({ data: null });
  await expect(MissedPaymentPolicyPage({ params: Promise.resolve({ transactionId: "bad" }) })).rejects.toThrow(
    "notFound",
  );
});
