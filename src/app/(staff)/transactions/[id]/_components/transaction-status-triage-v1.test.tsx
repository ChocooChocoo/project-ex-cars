import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransactionStatusTriageV1 } from "./transaction-status-triage-v1";

const onTransition = vi.fn().mockResolvedValue(undefined);
const onVisitOutcome = vi.fn().mockResolvedValue(undefined);

function renderTriage(overrides: Partial<Parameters<typeof TransactionStatusTriageV1>[0]> = {}) {
  render(
    <TransactionStatusTriageV1
      state="pending"
      kind="buy"
      openedAt="2026-10-01T00:00:00.000Z"
      completedAt={null}
      updatedAt="2026-10-02T00:00:00.000Z"
      userRole="sales_manager"
      transitioning={false}
      onTransition={onTransition}
      onVisitOutcome={onVisitOutcome}
      {...overrides}
    />,
  );
}

describe("TransactionStatusTriageV1 cash-buy rules (T05)", () => {
  it("hides Cancel from the Sales Manager on a cash buy", () => {
    renderTriage({ paymentMethod: "cash" });

    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    expect(screen.getByText("Move to Review")).toBeInTheDocument();
  });

  it("offers only Approve and Reject on a financing buy in review", () => {
    renderTriage({ state: "under_review", paymentMethod: "financing" });

    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("keeps Cancel for the CEO", () => {
    renderTriage({ paymentMethod: "cash", userRole: "ceo" });

    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("hides Buyer declined once the papers are requested", () => {
    renderTriage({
      state: "approved",
      paymentMethod: "cash",
      papersRequested: true,
      visit: { kind: "gce_visit", schedule: "2026-10-05T02:00:00.000Z" },
    });

    expect(screen.queryByText("Buyer declined")).not.toBeInTheDocument();
  });

  it("shows Buyer declined before the papers are requested", () => {
    renderTriage({
      state: "approved",
      paymentMethod: "cash",
      papersRequested: false,
      visit: { kind: "gce_visit", schedule: "2026-10-05T02:00:00.000Z" },
    });

    expect(screen.getByText("Buyer declined")).toBeInTheDocument();
  });

  it("hides both classified declines but keeps a late no-show at a cash meet-up", () => {
    renderTriage({
      state: "approved",
      paymentMethod: "cash",
      papersRequested: true,
      visit: { kind: "meetup", schedule: "2026-01-01T02:00:00.000Z" },
    });

    expect(screen.queryByText("Declined — Legit")).not.toBeInTheDocument();
    expect(screen.queryByText("Declined — Not Legit")).not.toBeInTheDocument();
    expect(screen.getByText("Buyer didn't show up")).toBeInTheDocument();
  });

  it("keeps the financing outcomes even when papers are requested", () => {
    renderTriage({
      state: "approved",
      paymentMethod: "financing",
      papersRequested: true,
      visit: { kind: "gce_visit", schedule: "2026-10-05T02:00:00.000Z" },
    });

    expect(screen.getByText("Buyer declined")).toBeInTheDocument();
  });
});

describe("TransactionStatusTriageV1 delivered cars (T07 CR1)", () => {
  it("offers no decline or no-show outcomes once the car is delivered", () => {
    renderTriage({
      state: "approved",
      paymentMethod: "financing",
      visit: { kind: "delivery", schedule: "2026-10-05T02:00:00.000Z", deliveryStatus: "delivered" },
    });

    expect(screen.queryByText("Declined — Legit")).not.toBeInTheDocument();
    expect(screen.queryByText("Declined — Not Legit")).not.toBeInTheDocument();
    expect(screen.queryByText("Buyer unavailable")).not.toBeInTheDocument();
  });

  it("still offers Buyer unavailable while the team is arriving", () => {
    renderTriage({
      state: "approved",
      paymentMethod: "financing",
      visit: { kind: "delivery", schedule: "2026-10-05T02:00:00.000Z", deliveryStatus: "arriving" },
    });

    expect(screen.getByText("Buyer unavailable")).toBeInTheDocument();
  });
});

describe("TransactionStatusTriageV1 Head Accountant (T05)", () => {
  it("no longer offers Mark Sold", () => {
    renderTriage({ state: "approved", paymentMethod: "cash", userRole: "head_accountant" });

    expect(screen.queryByText("Mark Sold to This Buyer")).not.toBeInTheDocument();
    expect(screen.getByText(/another role takes the next step/)).toBeInTheDocument();
  });

  it("still says a completed transaction is terminal", () => {
    renderTriage({ state: "completed", userRole: "head_accountant" });

    expect(screen.getByText(/this transaction is in a terminal state/)).toBeInTheDocument();
  });
});

describe("TransactionStatusTriageV1 approval gate (BC-8)", () => {
  const approveButton = () => screen.getByText("Approve").closest("button") ?? screen.getByText("Approve");

  it("disables Approve and says what to verify first while the documents are unverified", () => {
    renderTriage({ state: "under_review", paymentMethod: "cash", verifiedPrerequisites: false });

    expect(approveButton()).toBeDisabled();
    expect(screen.getByText("Verify the IDs and proof of billing first.")).toBeInTheDocument();
  });

  it("enables Approve once the API reports the verified IDs and proof of billing", () => {
    renderTriage({ state: "under_review", paymentMethod: "cash", verifiedPrerequisites: true });

    expect(approveButton()).toBeEnabled();
    expect(screen.queryByText("Verify the IDs and proof of billing first.")).not.toBeInTheDocument();
  });

  it("leaves Approve enabled when the page did not send the flag", () => {
    renderTriage({ state: "under_review", paymentMethod: "cash" });

    expect(approveButton()).toBeEnabled();
  });
});

describe("TransactionStatusTriageV1 rejection reason (BC-9)", () => {
  it("asks for the reason in a modal instead of the yes/no confirmation", async () => {
    const onTransition = vi.fn().mockResolvedValue(undefined);
    renderTriage({ state: "under_review", paymentMethod: "cash", onTransition });

    fireEvent.click(screen.getByText("Reject").closest("button") as HTMLButtonElement);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Why is this request being rejected?")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Reject request" });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Reason for rejecting"), {
      target: { value: "The proof of billing is not in the buyer's name" },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(onTransition).toHaveBeenCalledWith("rejected", "The proof of billing is not in the buyer's name"),
    );
  });
});
