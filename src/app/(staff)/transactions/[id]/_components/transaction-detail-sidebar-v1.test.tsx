import { render, screen } from "@testing-library/react";
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

// T03 SM1/HA1: document upload, preview and verification moved to TransactionDocumentsCard
// (transaction-documents-card.test.tsx).
