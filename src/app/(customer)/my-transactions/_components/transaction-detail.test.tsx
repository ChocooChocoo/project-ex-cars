import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransactionDetail } from "./transaction-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(customer)/my-transactions/actions", () => ({
  cancelTransaction: vi.fn(),
  saveBuyDetails: vi.fn(),
  uploadPurchaseDocument: vi.fn(),
}));
vi.mock("./transaction-preview", () => ({ TransactionPreview: () => null }));

const transaction = {
  id: "transaction-1",
  transaction_kind: "buy",
  current_state: "approved",
  opened_at: "2026-09-10T00:00:00.000Z",
  completed_at: null,
  vehicles: { make: "Toyota", model: "Vios", year: 2025, stock_code: "GCE-1", current_price: 800000 },
};

function renderDetail(documents: Record<string, unknown>[]) {
  render(
    <TransactionDetail
      transaction={transaction}
      history={[]}
      documents={documents}
      payments={[]}
      installmentAccount={null}
      paymentTerms={null}
      viewingArrangements={[]}
      autofill={null}
    />,
  );
}

describe("TransactionDetail document previews", () => {
  it("renders a signed image preview without exposing its private path", () => {
    renderDetail([
      {
        id: "doc-image",
        document_kind: "valid_id",
        id_type: "passport",
        verification_state: "pending",
        is_image: true,
        signed_url: "https://storage.test/signed/passport.jpg",
      },
    ]);

    expect(screen.getByRole("img", { name: "Valid ID preview" })).toHaveAttribute(
      "src",
      "https://storage.test/signed/passport.jpg",
    );
    expect(screen.queryByText(/private\/customer\/passport\.jpg/)).not.toBeInTheDocument();
  });

  it("renders signed non-image links and safe unavailable metadata", () => {
    renderDetail([
      {
        id: "doc-pdf",
        document_kind: "proof_of_billing",
        verification_state: "verified",
        is_image: false,
        signed_url: "https://storage.test/signed/bill.pdf",
      },
      {
        id: "doc-failed",
        document_kind: "valid_id",
        verification_state: "pending",
        is_image: true,
        signed_url: null,
      },
    ]);

    expect(screen.getByRole("link", { name: "Open proof of billing" })).toHaveAttribute(
      "href",
      "https://storage.test/signed/bill.pdf",
    );
    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/private\/customer/)).not.toBeInTheDocument();
  });
});
