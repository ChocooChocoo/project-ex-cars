import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { submitFinancingPayment, submitAdvancedPayment, refresh, success, error } = vi.hoisted(() => ({
  submitFinancingPayment: vi.fn(),
  submitAdvancedPayment: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success, error } }));
vi.mock("../actions", () => ({ submitFinancingPayment, submitAdvancedPayment }));

import { FinancingPaymentPanel } from "./financing-payment-panel";

const installments = [
  { id: "paid", state: "paid", due_date: "2026-10-15", amount_due: 1000, sequence_no: 1 },
  { id: "next", state: "due", due_date: "2026-11-15", amount_due: 1000, sequence_no: 2 },
  { id: "future", state: "upcoming", due_date: "2026-12-15", amount_due: 1000, sequence_no: 3 },
];
const props = { transactionId: "tx-1", account: { state: "active", installments }, payments: [] };

beforeEach(() => {
  vi.clearAllMocks();
  submitFinancingPayment.mockResolvedValue({ success: true });
  submitAdvancedPayment.mockResolvedValue({ success: true });
});

describe("financing payment panel", () => {
  it("disables resubmission while waiting and closes dialogs with Escape", async () => {
    let complete: (value: { success: true }) => void = () => undefined;
    submitFinancingPayment.mockImplementationOnce(
      () =>
        new Promise<{ success: true }>((resolve) => {
          complete = resolve;
        }),
    );
    render(<FinancingPaymentPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Payment" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Payment" }));
    fireEvent.submit(screen.getByRole("form", { name: "Payment" }));
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    complete({ success: true });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows paid count and the next installment; submits cash for accountant verification", async () => {
    render(<FinancingPaymentPanel {...props} />);
    expect(screen.getByText("Paid 1 of 3")).toBeInTheDocument();
    expect(screen.getByText(/Next due: 2026-11-15/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Payment" }));
    fireEvent.submit(screen.getByRole("form", { name: "Payment" }));
    await waitFor(() => expect(submitFinancingPayment).toHaveBeenCalled());
    const fd = submitFinancingPayment.mock.calls[0][0] as FormData;
    expect(fd.get("method")).toBe("cash");
    expect(refresh).toHaveBeenCalled();
  });

  it("selects multiple whole installments and shows their total", async () => {
    render(<FinancingPaymentPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Advanced Payment" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Installment 2/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Installment 3/ }));
    expect(screen.getByText(/Selected total:.*2,000/)).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("form", { name: "Advanced Payment" }));
    await waitFor(() => expect(submitAdvancedPayment).toHaveBeenCalled());
    expect((submitAdvancedPayment.mock.calls[0][0] as FormData).getAll("installment_ids")).toEqual(["next", "future"]);
  });

  it("requires proof for bank transfer and displays action errors without refreshing", async () => {
    submitFinancingPayment.mockResolvedValue({ error: "Upload proof" });
    render(<FinancingPaymentPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Payment" }));
    fireEvent.change(screen.getByLabelText("Payment method"), { target: { value: "bank_transfer" } });
    expect(screen.getByLabelText(/Payment proof/)).toBeRequired();
    fireEvent.submit(screen.getByRole("form", { name: "Payment" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("Upload proof"));
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
