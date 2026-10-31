import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransactionDetailSidebarV1 } from "./transaction-detail-sidebar-v1";

Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

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
    ]);

    expect(screen.getByRole("img", { name: "Sell vehicle attachment" })).toHaveAttribute(
      "src",
      "https://storage.test/signed/exterior.webp",
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

describe("TransactionDetailSidebarV1 record payment methods", () => {
  function openMethod(paymentMethod: string) {
    renderSidebar([], { kind: "buy", state: "approved", userRole: "sales_manager", paymentMethod });
    fireEvent.click(screen.getByRole("combobox", { name: "Method" }));
  }

  it("does not let staff record a bank transfer by hand for a bank-transfer buy", () => {
    openMethod("bank_transfer");

    expect(screen.getByRole("option", { name: "Cash" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Bank Transfer" })).not.toBeInTheDocument();
    expect(screen.getByText(/paid online through PayMongo and confirmed automatically/)).toBeInTheDocument();
  });

  it("still offers bank transfer for a cash buy and a financing installment", () => {
    openMethod("financing");

    expect(screen.getByRole("option", { name: "Bank Transfer" })).toBeInTheDocument();
  });
});

// T03 SM1/HA1: document upload, preview and verification moved to TransactionDocumentsCard
// (transaction-documents-card.test.tsx).
