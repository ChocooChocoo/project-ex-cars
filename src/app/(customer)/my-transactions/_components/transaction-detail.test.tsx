import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { saveBuyDetails } from "@/app/(customer)/my-transactions/actions";

import { TransactionDetail } from "./transaction-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(customer)/my-transactions/actions", () => ({
  cancelTransaction: vi.fn(),
  saveBuyDetails: vi.fn(),
  uploadPurchaseDocument: vi.fn(),
}));
vi.mock("./transaction-preview", () => ({
  TransactionPreview: ({ paper }: { paper: { total: number; paid?: number } }) => (
    <div data-testid="paper">{`${paper.total}/${paper.paid}`}</div>
  ),
}));

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

describe("TransactionDetail completed sell offer", () => {
  it("shows the agreed price as paid in full, not the asking price as due", () => {
    render(
      <TransactionDetail
        transaction={{
          ...transaction,
          transaction_kind: "sell",
          current_state: "completed",
          sell_details: { offered_amount: 520000, agreed_price: 450000 },
        }}
        history={[]}
        documents={[]}
        payments={[]}
        installmentAccount={null}
        paymentTerms={null}
        viewingArrangements={[]}
        autofill={null}
      />,
    );

    expect(screen.getByText("Agreed Price").nextElementSibling).toHaveTextContent("₱450,000");
    expect(screen.getByText("Decision").nextElementSibling).toHaveTextContent("Completed");
    expect(screen.getByTestId("paper")).toHaveTextContent("450000/450000");
  });
});

describe("TransactionDetail visit time", () => {
  it("books a GCE visit on the hour and sends the time as an instant", async () => {
    vi.mocked(saveBuyDetails).mockResolvedValue({ success: true });
    render(
      <TransactionDetail
        transaction={{ ...transaction, current_state: "pending", purchase_details: { arrangement_kind: "gce_visit" } }}
        history={[]}
        documents={[]}
        payments={[]}
        installmentAccount={null}
        paymentTerms={null}
        viewingArrangements={[]}
        autofill={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("Schedule"), { target: { value: "2033-03-05T10:25" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Details" }));

    await waitFor(() => expect(saveBuyDetails).toHaveBeenCalled());
    const sent = vi.mocked(saveBuyDetails).mock.calls[0][0] as FormData;
    expect(sent.get("schedule")).toBe(new Date("2033-03-05T10:00").toISOString());
  });
});

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
