import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransactionPaymentsTableV1 } from "./transaction-payments-table-v1";

vi.mock("next/image", () => ({
  // biome-ignore lint/performance/noImgElement: test stand-in for next/image
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const base = {
  id: "p1",
  amount: 20000,
  payment_kind: "balance",
  method: "bank_transfer",
  settlement_date: "2026-10-20",
  verified_by: null,
  rejected_at: null,
  rejection_reason: null,
  paymongo_checkout_id: null,
  paymongo_payment_id: null,
  proof_url: "https://example.test/deposit-slip.jpg",
};

function renderTable(payments: Record<string, unknown>[], canReview = true) {
  const onVerifyPayment = vi.fn().mockResolvedValue(undefined);
  const onRejectPayment = vi.fn().mockResolvedValue(undefined);
  render(
    <TransactionPaymentsTableV1
      payments={payments}
      canReview={canReview}
      onVerifyPayment={onVerifyPayment}
      onRejectPayment={onRejectPayment}
    />,
  );
  return { onVerifyPayment, onRejectPayment };
}

describe("TransactionPaymentsTableV1 (T03 HA2, HA3)", () => {
  it("opens the deposit slip photo in a larger view before verifying", () => {
    renderTable([base]);

    fireEvent.click(screen.getByRole("button", { name: /Open payment proof/ }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("asks for a reason in a modal before rejecting", async () => {
    const { onRejectPayment } = renderTable([base]);

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Reject payment" });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Amount on the deposit slip is wrong" },
    });
    fireEvent.click(confirm);

    await waitFor(() => expect(onRejectPayment).toHaveBeenCalledWith("p1", "Amount on the deposit slip is wrong"));
  });

  it("shows a rejected payment with its reason, without actions, and leaves it out of the total", () => {
    renderTable([
      {
        ...base,
        id: "p1",
        amount: 20000,
        rejected_at: "2026-10-26T03:00:00Z",
        rejection_reason: "Transfer was reversed",
      },
      { ...base, id: "p2", amount: 5000, proof_url: null },
    ]);

    // The badge on the row, plus the "Rejected" count in the summary strip.
    expect(screen.getAllByText("Rejected")).toHaveLength(2);
    expect(screen.getByText("Transfer was reversed")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Reject" })).toHaveLength(1);
    // ₱5,000.00 twice: the counted row and the total; the rejected ₱20,000 is not added.
    expect(screen.getAllByText("₱5,000.00")).toHaveLength(2);
    expect(screen.queryByText("₱25,000.00")).not.toBeInTheDocument();
  });

  it("hides Verify and Reject from roles that do not review payments", () => {
    renderTable([base], false);

    expect(screen.queryByRole("button", { name: "Verify" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });
});
