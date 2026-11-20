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
      onWaiveInstallment={noop}
      onInstructRepossession={noop}
      {...overrides}
    />,
  );
}

describe("TransactionDetailSidebarV1 private media", () => {
  it("shows verified installment count instead of counting payment submissions", () => {
    renderSidebar([], {
      kind: "buy",
      installmentAccount: {
        installments: [
          { id: "1", state: "paid", sequence_no: 1, due_date: "2026-10-15", amount_due: 1000 },
          { id: "2", state: "upcoming", sequence_no: 2, due_date: "2026-12-15", amount_due: 1000 },
          { id: "3", state: "waived", sequence_no: 3, due_date: "2027-01-15", amount_due: 1000 },
        ],
      },
    });
    expect(screen.getByText("Paid 1 of 3")).toBeInTheDocument();
  });

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

    const thumbnail = screen.getByRole("img", { name: "Sell vehicle attachment" });
    // Phase 4b: non-Laravel storage links load as they are until this page moves to Laravel (Phase 5).
    expect(thumbnail.getAttribute("src")).toBe("https://storage.test/signed/exterior.webp");
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

  it("keeps the PayMongo note for a bank transfer buy, with a cash fallback", () => {
    renderPayment({
      paymentMethod: "bank_transfer",
      purchaseDetails: { ...cashVisit, payment_method: "bank_transfer" },
    });

    expect(screen.getByText(/paid online through PayMongo and confirmed automatically/)).toBeInTheDocument();
    // The buyer may still pay in cash on the day, so the fallback stays, but it stays disabled until
    // the Sales Manager types the amount.
    expect(screen.getByRole("button", { name: "Record Payment" })).toBeDisabled();
  });

  it("shows no Record Payment form for a financing buy before the Initial Downpayment is due", () => {
    renderPayment({
      purchaseDetails: { payment_method: "financing", arrangement_kind: "gce_visit", final_price: 600_000 },
      flowStatus: "gce_visit_scheduled_dp_pending",
    });

    expect(screen.queryByRole("button", { name: "Record Payment" })).not.toBeInTheDocument();
  });
});

// T11: the Initial Downpayment of a financing buy is cash at GCE, so the sidebar records it.
describe("TransactionDetailSidebarV1 financing Initial Downpayment (T11)", () => {
  function renderFinancing(overrides: Partial<Parameters<typeof TransactionDetailSidebarV1>[0]> = {}) {
    const onRecordPayment = vi.fn().mockResolvedValue(true);
    renderSidebar([], {
      kind: "buy",
      state: "approved",
      userRole: "sales_manager",
      purchaseDetails: {
        payment_method: "financing",
        arrangement_kind: "gce_visit",
        final_price: 600_000,
        downpayment_amount: 60_000,
      },
      paymentTerms: { state: "approved", total_amount: 660_000, down_payment: 60_000 },
      flowStatus: "purchase_claim",
      onRecordPayment,
      ...overrides,
    });
    return { onRecordPayment };
  }

  it("offers the Initial Downpayment form for a financing buy in Purchase Claim", () => {
    renderFinancing();

    expect(screen.getByRole("button", { name: "Record Initial Downpayment" })).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (₱)")).toHaveValue("₱60,000.00");
    expect(screen.getByLabelText("Payment for")).toHaveValue("Downpayment");
    expect(screen.getByLabelText("Method")).toHaveValue("Cash");
  });

  it("records the downpayment as a cash downpayment", async () => {
    const { onRecordPayment } = renderFinancing();

    fireEvent.click(screen.getByRole("button", { name: "Record Initial Downpayment" }));

    await waitFor(() =>
      expect(screen.getByText("Recorded, waiting for the Head Accountant's check.")).toBeInTheDocument(),
    );
    expect(onRecordPayment).toHaveBeenCalledWith("60000", "cash", expect.any(String), "downpayment", undefined);
  });

  it("hides the form once the downpayment is verified", () => {
    renderFinancing({
      payments: [{ payment_kind: "downpayment", amount: 60_000, verified_by: "accountant-1", rejected_at: null }],
    });

    expect(screen.queryByText("Initial Downpayment")).not.toBeInTheDocument();
  });
});

// T11: the Sales Manager can settle the upcoming installments in one advance payment.
describe("TransactionDetailSidebarV1 advance payment (T11)", () => {
  const account = {
    installments: [
      { id: "1", state: "paid", sequence_no: 1, due_date: "2026-10-15", amount_due: 1000 },
      { id: "2", state: "upcoming", sequence_no: 2, due_date: "2099-12-15", amount_due: 2000 },
      { id: "3", state: "upcoming", sequence_no: 3, due_date: "2099-11-15", amount_due: 3000 },
    ],
  };

  function renderSchedule(userRole: string, onRecordAdvancePayment = vi.fn().mockResolvedValue(undefined)) {
    renderSidebar([], {
      kind: "buy",
      state: "approved",
      userRole,
      installmentAccount: account,
      purchaseDetails: { payment_method: "financing", arrangement_kind: "gce_visit", final_price: 600_000 },
      onRecordAdvancePayment,
    });
    return { onRecordAdvancePayment };
  }

  it("offers the Sales Manager the unpaid upcoming installments", async () => {
    const { onRecordAdvancePayment } = renderSchedule("sales_manager");

    fireEvent.click(screen.getByRole("button", { name: "Record advance payment" }));
    fireEvent.click(screen.getByLabelText(/#2/));
    fireEvent.click(screen.getByLabelText(/#3/));
    fireEvent.click(screen.getByRole("button", { name: "Pay 2 in advance" }));

    await waitFor(() => expect(onRecordAdvancePayment).toHaveBeenCalledWith(["2", "3"]));
  });

  it("hides the control from the Head Accountant", () => {
    renderSchedule("head_accountant");

    expect(screen.queryByRole("button", { name: "Record advance payment" })).not.toBeInTheDocument();
  });

  it("shows what the payments on record say about each installment", () => {
    renderSidebar([], {
      kind: "buy",
      state: "approved",
      userRole: "sales_manager",
      installmentAccount: account,
      payments: [
        { installment_id: "2", amount: 2000, verified_by: "accountant-1", rejected_at: null },
        { installment_id: "3", amount: 3000, verified_by: null, rejected_at: null },
      ],
    });

    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Recorded, waiting for confirmation")).toBeInTheDocument();
  });
});

// T03 SM1/HA1: document upload, preview and verification moved to TransactionDocumentsCard
// (transaction-documents-card.test.tsx).
