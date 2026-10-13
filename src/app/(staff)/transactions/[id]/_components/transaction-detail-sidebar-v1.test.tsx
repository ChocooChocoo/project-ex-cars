import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransactionDetailSidebarV1 } from "./transaction-detail-sidebar-v1";

const noop = vi.fn().mockResolvedValue(undefined);

function renderSidebar(
  documents: Record<string, unknown>[],
  overrides: Partial<Parameters<typeof TransactionDetailSidebarV1>[0]> = {},
) {
  render(
    <TransactionDetailSidebarV1
      kind="sell"
      state="under_review"
      userRole="sales_manager"
      payments={[]}
      documents={documents}
      history={[]}
      installmentAccount={null}
      viewingArrangements={[]}
      informants={[]}
      sellDetails={{}}
      onRecordPayment={noop}
      onUploadDocument={noop}
      onVerifyDocument={noop}
      onRejectDocument={noop}
      onRecordPaperwork={noop}
      onWaiveInstallment={noop}
      onInstructRepossession={noop}
      {...overrides}
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

describe("TransactionDetailSidebarV1 document check", () => {
  const pendingId = {
    id: "id-1",
    document_kind: "valid_id",
    verification_state: "pending",
    is_image: true,
    signed_url: "https://storage.test/signed/id.jpg",
  };

  it("asks for a resubmission only once the Sales Manager says what to fix", () => {
    const onRejectDocument = vi.fn().mockResolvedValue(undefined);
    renderSidebar([pendingId], { kind: "buy", onRejectDocument });

    const ask = screen.getByRole("button", { name: "Ask to resubmit" });
    expect(ask).toBeDisabled();

    fireEvent.change(screen.getByLabelText("What to fix on Valid ID"), { target: { value: " Blurred photo " } });
    fireEvent.click(ask);

    expect(onRejectDocument).toHaveBeenCalledWith("id-1", "Blurred photo");
  });

  it("opens a document image in a larger view", () => {
    renderSidebar([pendingId], { kind: "buy" });

    fireEvent.click(screen.getByRole("button", { name: "Open Valid ID document preview in a larger view" }));

    expect(screen.getByRole("dialog", { name: "Valid ID document preview" })).toBeInTheDocument();
  });
});
