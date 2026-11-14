import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { cancelTransaction, removePurchaseDocument, saveBuyDetails } from "@/app/(customer)/my-transactions/actions";
import type { ProfileAutoFill } from "@/lib/autofill";

import { TransactionDetail } from "./transaction-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(customer)/my-transactions/actions", () => ({
  cancelTransaction: vi.fn(),
  removePurchaseDocument: vi.fn(),
  saveBuyDetails: vi.fn(),
  signContract: vi.fn(),
  uploadPurchaseDocument: vi.fn(),
  submitBuyRequest: vi.fn(),
  respondToFinancingOffer: vi.fn(),
  startInstallmentCheckout: vi.fn(),
}));
vi.mock("@/app/(customer)/my-transactions/review-actions", () => ({ submitReview: vi.fn() }));
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

describe("T07 customer transaction controls", () => {
  it("renders financing payment controls and paid count for an active account", () => {
    render(
      <TransactionDetail
        transaction={{
          ...transaction,
          purchase_details: { payment_method: "financing", arrangement_kind: "gce_visit" },
        }}
        history={[]}
        documents={[]}
        payments={[]}
        installmentAccount={{
          state: "active",
          installments: [
            { id: "1", state: "paid", due_date: "2026-10-15", amount_due: 1000 },
            { id: "2", state: "upcoming", due_date: "2026-12-15", amount_due: 1000 },
          ],
        }}
        paymentTerms={null}
        viewingArrangements={[]}
        autofill={null}
      />,
    );
    expect(screen.getByText("Paid 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Payment" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Advanced Payment" })).toBeEnabled();
  });

  function detail(
    tx: Record<string, unknown>,
    paymentTerms: Record<string, unknown> | null = null,
    autofill: ProfileAutoFill | null = null,
  ) {
    return render(
      <TransactionDetail
        transaction={{ ...transaction, ...tx }}
        history={[]}
        documents={[]}
        payments={[]}
        installmentAccount={null}
        paymentTerms={paymentTerms}
        viewingArrangements={[]}
        autofill={autofill}
        delivery={null}
        review={null}
      />,
    );
  }
  it("offers both Full Payment and Financing on a pending buy", async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    detail({ current_state: "pending" });
    fireEvent.keyDown(screen.getByLabelText("Payment Option"), { key: "Enter" });
    expect(await screen.findByRole("option", { name: "Full Payment" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Financing" })).toBeInTheDocument();
  });
  it("renders Financing for a pending buyer and retains a saved financing selection", () => {
    detail({
      current_state: "pending",
      purchase_details: {
        payment_option: "financing",
        payment_method: "financing",
        arrangement_kind: "gce_visit",
        requested_term_months: 12,
      },
    });
    expect(screen.getByLabelText("Payment Option")).toHaveTextContent("Financing");
    expect(screen.getByLabelText("Payment term")).toHaveTextContent("1 year");
    expect(screen.queryByLabelText("Payment Method")).not.toBeInTheDocument();
  });
  it("requires a PSGC location and blocks saving until one is chosen", () => {
    detail({ current_state: "pending", purchase_details: { arrangement_kind: "meetup" } });
    expect(screen.getByText("Choose the region, city and barangay for the meet-up or delivery.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Details" })).toBeDisabled();
  });
  it("starts the location from the profile address (T10)", () => {
    detail({ current_state: "pending", purchase_details: { arrangement_kind: "meetup" } }, null, {
      full_name: "Ana",
      email: "ana@gce.test",
      phone: null,
      address: "Bagong Kalsada, City of Calamba, Laguna, CALABARZON",
      address_line: null,
      region_code: "040000000",
      province_code: "043400000",
      city_code: "043405000",
      barangay_code: "043405001",
    });
    expect(screen.queryByText("Choose the region, city and barangay for the meet-up or delivery.")).toBeNull();
  });
  it("requires agreement before cancelling active financing and sends consent", async () => {
    vi.mocked(cancelTransaction).mockResolvedValue({ success: true });
    detail({ flow_status: "financing_active", purchase_details: { payment_method: "financing" } }, { state: "active" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel Transaction" }));
    const confirm = screen.getByRole("button", { name: "Yes, Cancel Transaction" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByLabelText("I agree that GCE will tow and take back the car."));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(cancelTransaction).toHaveBeenCalled());
    expect(vi.mocked(cancelTransaction).mock.calls.at(-1)?.[0].get("towing_ack")).toBe("yes");
  });
  it("offers reviews only after completion", () => {
    detail({ current_state: "completed" });
    expect(screen.getByRole("heading", { name: "Rate GCE" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit review" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Your review"), { target: { value: "Helpful staff" } });
    expect(screen.getByRole("button", { name: "Submit review" })).toBeEnabled();
  });
});

describe("TransactionDetail visit time", () => {
  function renderPendingVisit() {
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
  }

  it("refuses to save a date without an hour, so no silent empty slot is booked", () => {
    renderPendingVisit();

    fireEvent.change(screen.getByLabelText("Schedule"), { target: { value: "2033-03-05" } });

    expect(screen.getByRole("button", { name: "Save Details" })).toBeDisabled();
    expect(screen.getByText("Pick an hour for your slot before saving.")).toBeInTheDocument();
    expect(saveBuyDetails).not.toHaveBeenCalled();
  });

  it("says GCE is closed on a Sunday and offers no hour list", () => {
    renderPendingVisit();

    fireEvent.change(screen.getByLabelText("Schedule"), { target: { value: "2033-03-06" } });

    expect(screen.getByText("GCE is closed on Sundays.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Hour")).not.toBeInTheDocument();
  });

  it("lists the slots already taken in Manila time, not UTC", () => {
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
        takenSlots={["2033-03-08T02:00:00.000Z"]}
      />,
    );

    expect(screen.getByText(/Already taken: Mar 8, 10:00 AM/)).toBeInTheDocument();
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

    const thumbnail = screen.getByRole("img", { name: "Valid ID preview" });
    const thumbnailUrl = new URL(thumbnail.getAttribute("src") ?? "", window.location.origin);
    expect(thumbnailUrl.pathname).toBe("/api/transaction-thumbnail");
    expect(thumbnailUrl.searchParams.get("src")).toBe("https://storage.test/signed/passport.jpg");
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

describe("TransactionDetail ID sides and removal", () => {
  function renderPendingBuy(documents: Record<string, unknown>[]) {
    render(
      <TransactionDetail
        transaction={{ ...transaction, current_state: "pending" }}
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

  const pendingFront = {
    id: "doc-front",
    document_kind: "valid_id",
    id_type: "passport",
    id_side: "front",
    verification_state: "pending",
    is_image: false,
    signed_url: null,
  };

  it("T06: lists two valid IDs, front and back, and one proof of billing", () => {
    renderPendingBuy([pendingFront]);

    expect(screen.getByText("Valid ID #1")).toBeInTheDocument();
    expect(screen.getByText("Valid ID #2")).toBeInTheDocument();
    expect(screen.getByText("Proof of billing")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Front")).toHaveLength(1);
    expect(screen.getAllByLabelText("Back")).toHaveLength(2);
    expect(screen.getAllByText("Missing")).toHaveLength(4);
  });

  it("shows the side of an ID and removes a pending image", async () => {
    vi.mocked(removePurchaseDocument).mockResolvedValue({ success: true });
    renderPendingBuy([pendingFront]);

    expect(screen.getByText("front")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Valid ID (front)" }));

    await waitFor(() => expect(removePurchaseDocument).toHaveBeenCalledWith("doc-front"));
  });

  it("hides Remove once the request has been sent", () => {
    render(
      <TransactionDetail
        transaction={{ ...transaction, current_state: "under_review" }}
        history={[]}
        documents={[pendingFront]}
        payments={[]}
        installmentAccount={null}
        paymentTerms={null}
        viewingArrangements={[]}
        autofill={null}
      />,
    );

    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
  });
});

describe("TransactionDetail contract", () => {
  function renderApprovedBuy(purchase_details: Record<string, unknown>, contract_state: string | null) {
    render(
      <TransactionDetail
        transaction={{ ...transaction, purchase_details, sale_handovers: { contract_state } }}
        history={[]}
        documents={[]}
        payments={[]}
        installmentAccount={null}
        paymentTerms={null}
        viewingArrangements={[]}
        autofill={null}
      />,
    );
  }

  it("T06 G6: a cash delivery says the printed contract is signed on delivery, with no sign form", () => {
    renderApprovedBuy({ payment_method: "cash", arrangement_kind: "delivery" }, null);

    expect(screen.getByRole("heading", { name: "Your contract" })).toBeInTheDocument();
    expect(screen.getByText(/sign the printed contract with GCE staff when the car is delivered/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign contract/ })).not.toBeInTheDocument();
  });

  it("keeps the in-app contract for financing at a GCE visit", () => {
    renderApprovedBuy({ payment_method: "financing", arrangement_kind: "gce_visit" }, "pending_approval");

    expect(screen.getByRole("heading", { name: "Your contract" })).toBeInTheDocument();
    expect(screen.getByText(/You can read and sign it here once it is approved/)).toBeInTheDocument();
    expect(screen.queryByText(/sign the printed contract/)).not.toBeInTheDocument();
  });

  it("shows no contract on a cash buy at a GCE visit, which has none", () => {
    renderApprovedBuy({ payment_method: "cash", arrangement_kind: "gce_visit" }, null);

    expect(screen.queryByRole("heading", { name: "Your contract" })).not.toBeInTheDocument();
  });
});
