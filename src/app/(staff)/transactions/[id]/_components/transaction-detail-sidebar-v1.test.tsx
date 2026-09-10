import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransactionDetailSidebarV1 } from "./transaction-detail-sidebar-v1";

const noop = vi.fn().mockResolvedValue(undefined);

function renderSidebar(documents: Record<string, unknown>[]) {
  render(
    <TransactionDetailSidebarV1
      kind="sell"
      state="under_review"
      userRole="sales_manager"
      payments={[]}
      documents={documents}
      history={[]}
      installmentAccount={null}
      paymentTerms={null}
      viewingArrangements={[]}
      informants={[]}
      sellDetails={{}}
      onRecordPayment={noop}
      onReviewSell={noop}
      onUploadDocument={noop}
      onVerifyDocument={noop}
      onRejectDocument={noop}
      onApprovePaymentTerms={noop}
      onActivatePaymentTerms={noop}
      onRecordPaperwork={noop}
      onWaiveInstallment={noop}
      onInstructRepossession={noop}
    />,
  );
}

describe("TransactionDetailSidebarV1 private media", () => {
  it("renders signed document and vehicle photo previews without raw paths", () => {
    renderSidebar([
      {
        id: "photo-1",
        document_kind: "sell_photo",
        verification_state: "pending",
        is_image: true,
        signed_url: "https://storage.test/signed/exterior.webp",
      },
      {
        id: "pdf-1",
        document_kind: "proof_of_billing",
        verification_state: "verified",
        is_image: false,
        signed_url: "https://storage.test/signed/bill.pdf",
      },
    ]);

    expect(screen.getByRole("img", { name: "Sell vehicle attachment" })).toHaveAttribute(
      "src",
      "https://storage.test/signed/exterior.webp",
    );
    expect(screen.getByRole("link", { name: "Open proof of billing" })).toHaveAttribute(
      "href",
      "https://storage.test/signed/bill.pdf",
    );
    expect(screen.queryByText(/private\/sell|private\/docs/)).not.toBeInTheDocument();
  });

  it("shows safe fallback metadata when signing fails", () => {
    renderSidebar([
      {
        id: "photo-1",
        document_kind: "sell_photo",
        verification_state: "pending",
        is_image: true,
        signed_url: null,
      },
    ]);

    expect(screen.getAllByText("Preview unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText(/private\/sell\/secret\.jpg/)).not.toBeInTheDocument();
  });
});
