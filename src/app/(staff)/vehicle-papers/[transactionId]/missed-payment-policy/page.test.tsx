import { beforeEach, expect, it, vi } from "vitest";

const { requireRole, read, view } = vi.hoisted(() => ({ requireRole: vi.fn(), read: vi.fn(), view: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireRole }));
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

it("guards the printable fixed policy for CEO, Head Accountant and Sales Manager", async () => {
  read.mockResolvedValue({ data: { id: "tx" } });
  const element = await MissedPaymentPolicyPage({ params: Promise.resolve({ transactionId: "tx" }) });
  expect(requireRole).toHaveBeenCalledWith(["ceo", "head_accountant", "sales_manager"]);
  expect(element.type).toBe(view);
  expect(element.props.paper.title).toBe("MISSED PAYMENT POLICY");
  expect(element.props.paper.paragraphs[0]).toContain("4 consecutive missed monthly payments");
});

it("404s for an unknown transaction", async () => {
  read.mockResolvedValue({ data: null });
  await expect(MissedPaymentPolicyPage({ params: Promise.resolve({ transactionId: "bad" }) })).rejects.toThrow(
    "notFound",
  );
});
