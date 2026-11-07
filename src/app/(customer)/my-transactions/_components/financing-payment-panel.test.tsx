import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { startInstallmentCheckout, refresh, success, error } = vi.hoisted(() => ({
  startInstallmentCheckout: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success, error } }));
vi.mock("../actions", () => ({ startInstallmentCheckout }));

import { FinancingPaymentPanel } from "./financing-payment-panel";

const installments = [
  { id: "paid", state: "paid", due_date: "2026-10-15", amount_due: 1000, sequence_no: 1 },
  { id: "next", state: "due", due_date: "2026-11-15", amount_due: 1000, sequence_no: 2 },
  { id: "future", state: "upcoming", due_date: "2026-12-15", amount_due: 1000, sequence_no: 3 },
];
const props = { transactionId: "tx-1", account: { state: "active", installments }, payments: [] };

beforeEach(() => {
  vi.clearAllMocks();
  startInstallmentCheckout.mockResolvedValue({ success: true });
});

describe("financing payment panel", () => {
  it("opens the PayMongo dialog and closes it with Escape", () => {
    render(<FinancingPaymentPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Payment" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts a PayMongo checkout for the next installment", async () => {
    render(<FinancingPaymentPanel {...props} />);
    expect(screen.getByText("Paid 1 of 3")).toBeInTheDocument();
    expect(screen.getByText(/Next due: 2026-11-15/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Payment" }));
    fireEvent.click(screen.getByRole("button", { name: "Pay online" }));

    await waitFor(() => expect(startInstallmentCheckout).toHaveBeenCalled());
    const fd = startInstallmentCheckout.mock.calls[0][0] as FormData;
    expect(fd.get("transaction_id")).toBe("tx-1");
    expect(fd.get("advanced")).toBeNull();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("selects multiple whole installments and sends them to PayMongo", async () => {
    render(<FinancingPaymentPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Advanced Payment" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Installment 2/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Installment 3/ }));
    expect(screen.getByText(/Selected total:.*2,000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pay online" }));
    await waitFor(() => expect(startInstallmentCheckout).toHaveBeenCalled());
    const fd = startInstallmentCheckout.mock.calls[0][0] as FormData;
    expect(fd.get("advanced")).toBe("yes");
    expect(fd.getAll("installment_ids")).toEqual(["next", "future"]);
  });

  it("shows the action error without refreshing", async () => {
    startInstallmentCheckout.mockResolvedValue({ error: "PayMongo is down" });
    render(<FinancingPaymentPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Payment" }));
    fireEvent.click(screen.getByRole("button", { name: "Pay online" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("PayMongo is down"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("blocks a duplicate pending installment and shows pending/rejected payment history", () => {
    render(
      <FinancingPaymentPanel
        {...props}
        payments={[
          { id: "p1", installment_id: "next", amount: 1000, method: "cash", verified_by: null, rejected_at: null },
          {
            id: "p2",
            installment_id: "future",
            amount: 1000,
            method: "bank_transfer",
            rejected_at: "2026-11-01",
            rejection_reason: "Wrong slip",
          },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Payment" })).toBeDisabled();
    expect(screen.getByText("Pending verification")).toBeInTheDocument();
    expect(screen.getByText(/Wrong slip/)).toBeInTheDocument();
  });

  it("shows closed and empty states without payment buttons", () => {
    render(<FinancingPaymentPanel {...props} account={{ state: "closed", installments: [] }} />);
    expect(screen.getByText("No installment schedule yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Payment" })).not.toBeInTheDocument();
  });
});
