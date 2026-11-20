import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cancelTransaction, saveBuyDetails } from "@/app/(customer)/my-transactions/actions";
import type { ProfileAutoFill } from "@/lib/autofill";
import { DELIVERY_LEAD_DAYS, MEETUP_LEAD_DAYS, manilaDay } from "@/lib/transactions/buy-flow";

import { TransactionDetail } from "./transaction-detail";

// Radix measures the controls it renders; jsdom has no ResizeObserver.
globalThis.ResizeObserver = class {
  observe() {
    // noop
  }
  unobserve() {
    // noop
  }
  disconnect() {
    // noop
  }
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(customer)/my-transactions/actions", () => ({
  cancelTransaction: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe("TransactionDetail counter-offer (SH-6)", () => {
  function renderCounterOffer(counterOffer: { remarks: string | null; response: string | null }) {
    render(
      <TransactionDetail
        transaction={{
          ...transaction,
          transaction_kind: "sell",
          current_state: "approved",
          sell_details: { offered_amount: 520000, agreed_price: 400000 },
        }}
        history={[]}
        documents={[]}
        payments={[]}
        installmentAccount={null}
        paymentTerms={null}
        viewingArrangements={[]}
        autofill={null}
        counterOffer={counterOffer}
      />,
    );
  }

  it("shows the remarks for the seller and no ceiling amount", () => {
    renderCounterOffer({ remarks: "The timing belt needs replacing.", response: null });

    const card = screen.getByLabelText("GCE counter-offer");
    expect(card).toHaveTextContent("GCE revised offer");
    expect(card).toHaveTextContent("The timing belt needs replacing.");
    // SH-6: the approved revised ceiling (₱415,000) is internal and never printed here.
    expect(card).not.toHaveTextContent("415,000");
    expect(card).not.toHaveTextContent("₱");
  });

  it("reports the seller's own answer without quoting a price", () => {
    renderCounterOffer({ remarks: null, response: "agreed" });

    const card = screen.getByLabelText("GCE counter-offer");
    expect(card).toHaveTextContent("You accepted the revised offer.");
    expect(card).toHaveTextContent("No remarks given.");
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
    // T11: the installments are paid in cash or through PayMongo, so the method is asked for financing too.
    expect(screen.getByLabelText("Payment Method")).toHaveTextContent("PayMongo");
  });
  it("T11: keeps the financing pay method saved by the buyer", () => {
    detail({
      current_state: "pending",
      purchase_details: {
        payment_option: "financing",
        payment_method: "financing",
        arrangement_kind: "gce_visit",
        requested_term_months: 12,
        financing_pay_method: "cash",
      },
    });
    expect(screen.getByLabelText("Payment Method")).toHaveTextContent("Cash");
  });
  it("T11: saves the chosen financing pay method with the details", async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.mocked(saveBuyDetails).mockResolvedValue({ success: true });
    detail({
      current_state: "pending",
      purchase_details: {
        payment_option: "financing",
        payment_method: "financing",
        arrangement_kind: "gce_visit",
        requested_term_months: 12,
        financing_pay_method: "cash",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Details" }));

    await waitFor(() => expect(saveBuyDetails).toHaveBeenCalled());
    const fd = vi.mocked(saveBuyDetails).mock.calls.at(-1)?.[0] as FormData;
    expect(fd.get("financing_pay_method")).toBe("cash");
    expect(fd.get("payment_method")).toBe("financing");
  });
  it("asks for the meet-up pin instead of a PSGC address, and blocks saving until it is set (BH-8)", () => {
    detail({ current_state: "pending", purchase_details: { arrangement_kind: "meetup" } });
    expect(screen.getByText("Set the meet-up point on the map.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Details" })).toBeDisabled();
    expect(screen.queryByText(/Choose the region, city and barangay/)).not.toBeInTheDocument();
  });
  it("requires a PSGC location for a delivery and blocks saving until one is chosen", () => {
    detail({ current_state: "pending", purchase_details: { arrangement_kind: "delivery" } });
    expect(screen.getByText("Choose the region, city and barangay for the delivery.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Details" })).toBeDisabled();
  });
  it("starts a delivery location from the profile address (T10)", () => {
    detail({ current_state: "pending", purchase_details: { arrangement_kind: "delivery" } }, null, {
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
    expect(screen.queryByText("Choose the region, city and barangay for the delivery.")).toBeNull();
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

describe("TransactionDetail scheduling lead times (BH-1)", () => {
  function renderPending(arrangement: string) {
    render(
      <TransactionDetail
        transaction={{ ...transaction, current_state: "pending", purchase_details: { arrangement_kind: arrangement } }}
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

  it("needs 2 Manila days for a halfway meet-up, and says so", () => {
    renderPending("meetup");

    expect(screen.getByLabelText("Schedule")).toHaveAttribute("min", manilaDay(new Date(), MEETUP_LEAD_DAYS));
    expect(screen.getByText(/A halfway meet-up needs at least 2 days from today/)).toBeInTheDocument();
  });

  it("still lets a GCE visit be booked the same day", () => {
    renderPending("gce_visit");

    expect(screen.getByLabelText("Schedule")).toHaveAttribute("min", manilaDay(new Date()));
    expect(screen.queryByText(/needs at least/)).not.toBeInTheDocument();
  });

  it("keeps the 7-day lead time for a delivery", () => {
    renderPending("delivery");

    expect(screen.getByLabelText("Delivery date and time")).toHaveAttribute(
      "min",
      manilaDay(new Date(), DELIVERY_LEAD_DAYS),
    );
    expect(screen.getByText(/Delivery needs at least 7 days from today/)).toBeInTheDocument();
  });

  // The approved-financing offer reuses one picker id per screen, so each arrangement renders on its own.
  function renderFinancingOffer(arrangement: string) {
    render(
      <TransactionDetail
        transaction={{
          ...transaction,
          current_state: "approved",
          flow_status: "approved_awaiting_buyer_decision",
          purchase_details: { payment_option: "financing", payment_method: "financing", arrangement_kind: arrangement },
        }}
        history={[]}
        documents={[]}
        payments={[]}
        installmentAccount={null}
        paymentTerms={{ state: "approved", down_payment: 0, number_of_payments: 12, total_amount: 800000 }}
        viewingArrangements={[]}
        autofill={null}
      />,
    );
  }

  it("needs 2 Manila days for a financed meet-up booked after approval", () => {
    renderFinancingOffer("meetup");

    expect(screen.getByLabelText("Meet-up date and time")).toHaveAttribute(
      "min",
      manilaDay(new Date(), MEETUP_LEAD_DAYS),
    );
    expect(screen.getByText(/A halfway meet-up needs at least 2 days from today/)).toBeInTheDocument();
  });

  it("keeps a financed GCE visit bookable the same day", () => {
    renderFinancingOffer("gce_visit");

    expect(screen.getByLabelText("GCE visit date and time")).toHaveAttribute("min", manilaDay(new Date()));
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
    // Phase 4b: non-Laravel storage links load as they are until this page moves to Laravel (Phase 5).
    expect(thumbnail.getAttribute("src")).toBe("https://storage.test/signed/passport.jpg");
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

describe("TransactionDetail ID sides", () => {
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

  it("lists the four ID images, proof of billing, and latest payslip", () => {
    renderPendingBuy([pendingFront]);

    expect(screen.getByText("Valid ID #1")).toBeInTheDocument();
    expect(screen.getByText("Valid ID #2")).toBeInTheDocument();
    expect(screen.getByText("Proof of billing")).toBeInTheDocument();
    expect(screen.getByLabelText("Latest payslip")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Front")).toHaveLength(1);
    expect(screen.getAllByLabelText("Back")).toHaveLength(2);
    expect(screen.getAllByText("Missing")).toHaveLength(5);
  });

  it("shows the side of an ID and never offers to remove it (SN-14)", () => {
    renderPendingBuy([pendingFront]);

    expect(screen.getByText("front")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it("offers the upload slots again only once GCE asked for a new ID (SN-14)", () => {
    renderPendingBuy([{ ...pendingFront, verification_state: "rejected", rejection_reason: "Blurred photo" }]);

    // The checklist slot and the uploaded-files row both carry the reason staff gave.
    expect(screen.getAllByText(/GCE asked you to resubmit: Blurred photo/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText("Front").length).toBeGreaterThanOrEqual(1);
  });
});

describe("TransactionDetail seller papers (SH-13, SN-14)", () => {
  function renderSell(sell_details: Record<string, unknown>, documents: Record<string, unknown>[] = []) {
    render(
      <TransactionDetail
        transaction={{ ...transaction, transaction_kind: "sell", current_state: "pending", sell_details }}
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

  it("shows the answers the seller gave instead of a flat file list", () => {
    renderSell({
      offered_amount: 500000,
      papers_checklist: { official_receipt: "has", certificate_of_registration: "expired", deed_of_sale: "has" },
    });

    expect(screen.getByRole("heading", { name: "Your papers checklist" })).toBeInTheDocument();
    expect(screen.getByText("Official Receipt (OR)").nextElementSibling).toHaveTextContent("I have it");
    expect(screen.getByText("Certificate of Registration (CR)").nextElementSibling).toHaveTextContent("It is expired");
    expect(screen.queryByRole("heading", { name: "Documents" })).not.toBeInTheDocument();
  });

  it("hides the upload slots for a seller nothing was asked to resubmit", () => {
    renderSell({ offered_amount: 500000, papers_checklist: { official_receipt: "has" } }, [
      { id: "id-1", document_kind: "valid_id", verification_state: "verified", is_image: true, signed_url: null },
    ]);

    expect(screen.queryByText("GCE asked you to resubmit")).not.toBeInTheDocument();
    expect(screen.queryByText("Valid ID #1")).not.toBeInTheDocument();
  });

  it("offers the ID slots again when GCE rejected the seller's ID", () => {
    renderSell({ offered_amount: 500000, papers_checklist: { official_receipt: "has" } }, [
      {
        id: "id-1",
        document_kind: "valid_id",
        id_type: "passport",
        id_side: "front",
        verification_state: "rejected",
        rejection_reason: "Blurred photo",
        is_image: true,
        signed_url: null,
      },
    ]);

    expect(screen.getByText("GCE asked you to resubmit")).toBeInTheDocument();
    expect(screen.getByText(/GCE asked you to resubmit: Blurred photo/)).toBeInTheDocument();
    expect(screen.getByText("Valid ID #1")).toBeInTheDocument();
    expect(screen.queryByText("Proof of billing")).not.toBeInTheDocument();
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

  it("BC-2 / BC-3: a cash GCE visit is signed in the app once the Sales Manager has signed for GCE", () => {
    renderApprovedBuy({ payment_method: "cash", arrangement_kind: "gce_visit" }, "approved");

    expect(screen.getByRole("heading", { name: "Your contract" })).toBeInTheDocument();
    expect(screen.getByText(/The Sales Manager signs for GCE first/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign contract/ })).not.toBeInTheDocument();
  });

  it("T11: offers the signed contract and policy as a copy once it is signed", () => {
    renderApprovedBuy({ payment_method: "financing", arrangement_kind: "gce_visit" }, "signed");

    expect(screen.getByTestId("signed-copy-link")).toHaveAttribute("href", "/vehicle-papers/transaction-1/contract");
  });

  it("T11: shows no signed copy before the contract is signed", () => {
    renderApprovedBuy({ payment_method: "financing", arrangement_kind: "gce_visit" }, "approved");

    expect(screen.queryByTestId("signed-copy-link")).not.toBeInTheDocument();
  });
});

describe("TransactionDetail rejection reason (BC-9)", () => {
  function renderRejected(history: Record<string, unknown>[]) {
    render(
      <TransactionDetail
        transaction={{ ...transaction, current_state: "rejected" }}
        history={history}
        documents={[]}
        payments={[]}
        installmentAccount={null}
        paymentTerms={null}
        viewingArrangements={[]}
        autofill={null}
      />,
    );
  }

  it("prints the reason on the rejected banner, not only behind See reason", () => {
    renderRejected([
      {
        from_state: "under_review",
        to_state: "rejected",
        reason: "The proof of billing is not in the buyer's name.",
        changed_at: "2026-11-05T02:00:00.000Z",
      },
    ]);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("This request was not approved.");
    expect(banner).toHaveTextContent("Reason: The proof of billing is not in the buyer's name.");
    // The older modal is still there for the full record.
    expect(screen.getByRole("button", { name: "See reason" })).toBeInTheDocument();
  });

  it("keeps the banner when GCE recorded no reason", () => {
    renderRejected([]);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Reason: GCE did not record a reason. Contact support for details.",
    );
  });

  it("shows no rejection banner on an approved transaction", () => {
    render(
      <TransactionDetail
        transaction={{ ...transaction, current_state: "approved" }}
        history={[]}
        documents={[]}
        payments={[]}
        installmentAccount={null}
        paymentTerms={null}
        viewingArrangements={[]}
        autofill={null}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("TransactionDetail financial summary", () => {
  function renderFinancing(payments: Record<string, unknown>[]) {
    render(
      <TransactionDetail
        transaction={{
          ...transaction,
          purchase_details: { payment_method: "financing", arrangement_kind: "gce_visit" },
        }}
        history={[]}
        documents={[]}
        payments={payments}
        installmentAccount={{
          state: "active",
          financed_total: 3000,
          down_payment: 0,
          opening_balance: 3000,
          installments: [
            { id: "1", state: "paid", due_date: "2026-10-15", amount_due: 1000, sequence_no: 1 },
            { id: "2", state: "due", due_date: "2026-11-15", amount_due: 1000, sequence_no: 2 },
            { id: "3", state: "upcoming", due_date: "2026-12-15", amount_due: 1000, sequence_no: 3 },
          ],
        }}
        paymentTerms={null}
        viewingArrangements={[]}
        autofill={null}
      />,
    );
  }

  it("T11: totals paid to date from the paid installments and leaves the rest as the balance", () => {
    renderFinancing([{ id: "p1", amount: 1000, method: "cash", verified_by: "ha-1" }]);

    expect(screen.getByText("Paid to date").nextElementSibling).toHaveTextContent("₱1,000");
    expect(screen.getByText("Remaining balance").nextElementSibling).toHaveTextContent("₱2,000");
  });

  it("T11: labels a recorded but unverified payment as awaiting confirmation and does not count it", () => {
    renderFinancing([{ id: "p1", amount: 1000, method: "cash", verified_by: null, rejected_at: null }]);

    const summary = within(screen.getByRole("region", { name: "Financial summary" }));
    expect(summary.getByText("Awaiting confirmation", { exact: false })).toBeInTheDocument();
    expect(summary.getByText("Paid to date").nextElementSibling).toHaveTextContent("₱1,000");
    expect(summary.getByText("Remaining balance").nextElementSibling).toHaveTextContent("₱2,000");
  });

  it("T11: keeps a rejected payment out of the total and shows why it was refused", () => {
    renderFinancing([
      {
        id: "p1",
        amount: 1000,
        method: "cash",
        verified_by: null,
        rejected_at: "2026-10-01",
        rejection_reason: "No slip",
      },
    ]);

    const summary = within(screen.getByRole("region", { name: "Financial summary" }));
    expect(summary.getByText("Not accepted", { exact: false })).toBeInTheDocument();
    expect(summary.getByText(/No slip/)).toBeInTheDocument();
    expect(summary.getByText("Paid to date").nextElementSibling).toHaveTextContent("₱1,000");
  });
});

describe("TransactionDetail GCE Visit map after submitting (notes line 125)", () => {
  it("keeps the GCE office map once the buy requirements are submitted", () => {
    render(
      <TransactionDetail
        transaction={{
          ...transaction,
          current_state: "under_review",
          purchase_details: { arrangement_kind: "gce_visit", payment_plan: "full" },
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
    expect(screen.getByRole("heading", { name: "Where to meet" })).toBeInTheDocument();
    expect(screen.getByText(/GCE visits happen at the office on the pin/)).toBeInTheDocument();
  });
});
