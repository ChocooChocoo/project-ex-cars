import { beforeEach, expect, it, vi } from "vitest";

const { guard, read, view, signedUrl } = vi.hoisted(() => ({
  guard: vi.fn(),
  read: vi.fn(),
  view: vi.fn(),
  signedUrl: vi.fn(),
}));
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
    return {
      from: () => builder,
      storage: { from: () => ({ createSignedUrl: signedUrl }) },
    };
  },
}));
vi.mock("../../_components/paper-document-view", () => ({ PaperDocumentView: view }));
vi.mock("@/components/transaction-image-preview", () => ({ TransactionImagePreview: vi.fn() }));

import ContractPage from "./page";

const transaction = {
  id: "tx",
  opened_at: "2026-10-31T02:00:00.000Z",
  completed_at: null,
  purchase_details: { final_price: 500000 },
  profiles: { full_name: "Maria Santos", address: "12 Mabini St" },
  vehicles: { make: "Toyota", model: "Vios", year: 2022 },
};

beforeEach(() => {
  vi.clearAllMocks();
  signedUrl.mockResolvedValue({ data: { signedUrl: "https://example.test/signature.png" } });
});

it("renders the contract paper with both recorded signatures, behind the reader guard", async () => {
  read.mockResolvedValueOnce({ data: transaction }).mockResolvedValueOnce({
    data: {
      contract_body: "The buyer pays in 24 monthly installments.",
      contract_state: "signed",
      signature_path: "tx/signature-buyer-1.png",
      ci_signature_path: "tx/signature-ci-1.png",
    },
  });

  const element = await ContractPage({ params: Promise.resolve({ transactionId: "tx" }) });

  expect(guard).toHaveBeenCalledWith("tx", ["ceo", "head_accountant", "sales_manager"]);
  const paper = element.props.children[0].props.paper;
  expect(paper.title).toBe("CONTRACT");
  expect(paper.paragraphs.join("\n")).toContain("The buyer pays in 24 monthly installments.");
  expect(paper.paragraphs.join("\n")).toContain("Maria Santos");

  // Both storage paths are signed for the images shown under the sheet.
  expect(signedUrl).toHaveBeenCalledWith("tx/signature-buyer-1.png", expect.any(Number));
  expect(signedUrl).toHaveBeenCalledWith("tx/signature-ci-1.png", expect.any(Number));
  const signatures = element.props.children[1];
  const cards = signatures.props.children[1].props.children;
  expect(
    cards.map((card: { props: { children: { props: { src: string } }[] } }) => card.props.children[1].props.src),
  ).toEqual(["https://example.test/signature.png", "https://example.test/signature.png"]);
});

it("prints the blank line note when GCE wrote no contract body", async () => {
  read.mockResolvedValueOnce({ data: transaction }).mockResolvedValueOnce({ data: null });

  const element = await ContractPage({ params: Promise.resolve({ transactionId: "tx" }) });

  const paper = element.props.children[0].props.paper;
  expect(paper.paragraphs.join("\n")).toContain("GCE has not recorded the contract terms yet.");
  expect(signedUrl).not.toHaveBeenCalled();
});

it("404s for an unknown transaction", async () => {
  read.mockResolvedValue({ data: null });
  await expect(ContractPage({ params: Promise.resolve({ transactionId: "bad" }) })).rejects.toThrow("notFound");
});
