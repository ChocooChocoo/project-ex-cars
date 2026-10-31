import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransactionDetailSidebarV1 } from "./transaction-detail-sidebar-v1";

Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

const noop = vi.fn().mockResolvedValue(undefined);
const noopRecord = vi.fn().mockResolvedValue(true);

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
      onRecordPayment={noopRecord}
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

describe("TransactionDetailSidebarV1 record payment (T05)", () => {
  const cashVisit = { payment_method: "cash", arrangement_kind: "gce_visit", final_price: 600_000 };

  function renderPayment(overrides: Partial<Parameters<typeof TransactionDetailSidebarV1>[0]> = {}) {
    const onRecordPayment = vi.fn().mockResolvedValue(true);
    renderSidebar([], {
      kind: "buy",
      state: "approved",
      userRole: "sales_manager",
      purchaseDetails: cashVisit,
      onRecordPayment,
      ...overrides,
    });
    return { onRecordPayment };
  }

  it("prefills the amount, the payment kind and the method, read-only", () => {
    renderPayment();

    const amount = screen.getByLabelText("Amount (₱)");
    expect(amount).toHaveValue("₱600,000.00");
    expect(amount).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Payment for")).toHaveValue("Full Payment");
    expect(screen.getByLabelText("Payment for")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Method")).toHaveValue("Cash");
    expect(screen.getByLabelText("Method")).toHaveAttribute("readonly");
    // The date and the proof photo stay the Sales Manager's.
    expect(screen.getByLabelText("Date")).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText(/Photo of deposit slip/)).toBeInTheDocument();
  });

  it("records the prefilled payment and says it waits for the check", async () => {
    const { onRecordPayment } = renderPayment();

    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() =>
      expect(screen.getByText("Recorded, waiting for the Head Accountant's check.")).toBeInTheDocument(),
    );
    expect(onRecordPayment).toHaveBeenCalledTimes(1);
    expect(onRecordPayment).toHaveBeenCalledWith("600000", "cash", expect.any(String), "full", undefined);
    expect(screen.queryByRole("button", { name: "Record Payment" })).not.toBeInTheDocument();
  });

  it("records exactly one payment when Submit is double-clicked", async () => {
    let settle: (recorded: boolean) => void = () => undefined;
    const onRecordPayment = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    );
    renderPayment({ onRecordPayment });

    const submit = screen.getByRole("button", { name: "Record Payment" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(onRecordPayment).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();

    settle(true);
    await waitFor(() =>
      expect(screen.getByText("Recorded, waiting for the Head Accountant's check.")).toBeInTheDocument(),
    );
  });

  it("hides the form from the Head Accountant", () => {
    renderPayment({ userRole: "head_accountant" });

    expect(screen.queryByRole("button", { name: "Record Payment" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Amount (₱)")).not.toBeInTheDocument();
  });

  it("shows the note instead of a second form while a payment waits for the check", () => {
    renderPayment({
      payments: [{ payment_kind: "full", amount: 600_000, verified_by: null, rejected_at: null }],
    });

    expect(screen.queryByRole("button", { name: "Record Payment" })).not.toBeInTheDocument();
    expect(screen.getByText("Recorded, waiting for the Head Accountant's check.")).toBeInTheDocument();
  });

  it("keeps the PayMongo note for a bank transfer buy", () => {
    renderPayment({
      paymentMethod: "bank_transfer",
      purchaseDetails: { ...cashVisit, payment_method: "bank_transfer" },
    });

    expect(screen.getByText(/paid online through PayMongo and confirmed automatically/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record Payment" })).not.toBeInTheDocument();
  });

  it("shows no Record Payment form for a financing buy", () => {
    renderPayment({
      purchaseDetails: { payment_method: "financing", arrangement_kind: "gce_visit", final_price: 600_000 },
    });

    expect(screen.queryByRole("button", { name: "Record Payment" })).not.toBeInTheDocument();
  });
});

// T03 SM1/HA1: document upload, preview and verification moved to TransactionDocumentsCard
// (transaction-documents-card.test.tsx).
