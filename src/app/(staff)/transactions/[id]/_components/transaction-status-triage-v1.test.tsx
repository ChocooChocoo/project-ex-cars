import { render, screen } from "@testing-library/react";
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

  it("keeps Cancel on a financing buy", () => {
    renderTriage({ paymentMethod: "financing" });

    expect(screen.getByText("Cancel")).toBeInTheDocument();
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
