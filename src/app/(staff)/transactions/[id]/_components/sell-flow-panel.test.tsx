import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/transactions/sell-actions", () => ({
  createInspectionIssueReport: vi.fn().mockResolvedValue({ success: true }),
  flagSellSubmission: vi.fn(),
  proposePurchaseCeiling: vi.fn(),
  recordAgreedPrice: vi.fn(),
  recordSellerResponse: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/app/(staff)/vehicles/actions", () => ({ approvePrice: vi.fn() }));
// Leaflet needs `window`; the panels only read the pin, so a stub keeps jsdom out of it.
vi.mock("@/components/maps/lazy-maps", () => ({
  MeetupMap: () => <div data-testid="meetup-map" />,
}));

import { recordSellerResponse } from "@/app/(staff)/transactions/sell-actions";
import { MEETUP_LEAD_DAYS, MEETUP_LEAD_MESSAGE, manilaDay } from "@/lib/transactions/buy-flow";

import { SellFlowPanel } from "./sell-flow-panel";

const transaction = { id: "00000000-0000-4000-8000-000000000001", current_state: "approved" };

function renderPanel(method: "meet_halfway" | "gce_visit") {
  render(
    <SellFlowPanel
      transaction={transaction}
      sellDetails={{
        offered_amount: 500000,
        meetup_method: method,
        meetup_lat: 14.33,
        meetup_lng: 120.94,
        meetup_address: "Block 4 Lot 5, Bagong Bayan, Dasmariñas, Cavite, Calabarzon",
      }}
      documents={[]}
      userRole="marketing_specialist"
      informants={[]}
      data={{ proposals: [], fieldCase: null, issueReport: null, expenses: [], threadId: null, mechanics: [] }}
    />,
  );
}

// SH-6: an offer past the inspection, with the CEO-approved revised ceiling and the report awaiting the seller.
const approvedProposal = {
  id: "proposal-revised",
  proposal_kind: "revised_ceiling",
  proposed_amount: 415000,
  decision: "approved",
  created_at: "2026-11-02T00:00:00Z",
};

function renderNegotiation(agreedPrice: number | null, recalculatedPrice?: number) {
  render(
    <SellFlowPanel
      transaction={transaction}
      sellDetails={{ offered_amount: 500000, meetup_method: "gce_visit", agreed_price: agreedPrice }}
      documents={[]}
      userRole="marketing_specialist"
      informants={[]}
      data={{
        proposals: [
          {
            ...approvedProposal,
            id: "proposal-purchase",
            proposal_kind: "purchase_ceiling",
            proposed_amount: 430000,
            created_at: "2026-11-01T00:00:00Z",
          },
          approvedProposal,
        ],
        fieldCase: {
          id: "case-1",
          state: "in_progress",
          inspection_outcome: "issue_found",
          issue_description: "Worn clutch",
        },
        issueReport: {
          id: "report-1",
          proposal_id: approvedProposal.id,
          issue_found: "Worn clutch",
          repair_estimate: 15000,
          is_profitable: true,
          profitability_reason: "Still a margin",
          seller_remarks: "The timing belt needs replacing.",
          recalculated_price: recalculatedPrice ?? null,
          new_ceiling: 415000,
          seller_response: null,
        },
        expenses: [],
        threadId: null,
        mechanics: [],
      }}
    />,
  );
}

function typeSchedule(value: string) {
  fireEvent.change(screen.getByLabelText("Meet-up date and time"), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SellFlowPanel meet-up schedule (SH-12 / BH-1)", () => {
  it("opens the field on now in Manila", () => {
    renderPanel("gce_visit");

    // The minimum is this minute in Manila, so a passed time cannot be picked at all.
    const min = screen.getByLabelText("Meet-up date and time").getAttribute("min");
    expect(min).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(`${min}:00+08:00`).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("refuses a schedule that already passed, before sending anything", () => {
    renderPanel("meet_halfway");
    typeSchedule("2020-01-02T10:00");

    expect(screen.getByText("Set a future meet-up date and time.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create field case" })).toBeDisabled();
  });

  it("keeps the 2-day lead time for a Meet Halfway trip", () => {
    renderPanel("meet_halfway");
    // Tomorrow is in the future but short of 2 Manila calendar days.
    typeSchedule(`${manilaDay(new Date(), 1)}T10:00`);

    expect(screen.getByText(MEETUP_LEAD_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create field case" })).toBeDisabled();
  });

  it("still allows a GCE visit the same day", () => {
    renderPanel("gce_visit");
    typeSchedule(`${manilaDay(new Date())}T21:00`);

    expect(screen.queryByText(MEETUP_LEAD_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText("Set a future meet-up date and time.")).not.toBeInTheDocument();
  });

  it("accepts the boundary day of a Meet Halfway trip", () => {
    renderPanel("meet_halfway");
    typeSchedule(`${manilaDay(new Date(), MEETUP_LEAD_DAYS)}T09:00`);

    expect(screen.queryByText(MEETUP_LEAD_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create field case" })).toBeEnabled();
  });
});

describe("SellFlowPanel facts grid (SH-5 / SH-6)", () => {
  it("shows asking price, both ceilings and the final agreed price as separate values", () => {
    renderNegotiation(400000);

    expect(screen.getByText("Asking price").nextElementSibling).toHaveTextContent("₱500,000");
    expect(screen.getByText("Approved ceiling").nextElementSibling).toHaveTextContent("₱430,000");
    expect(screen.getByText("Revised ceiling").nextElementSibling).toHaveTextContent("₱415,000");
    expect(screen.getByText("Final agreed price").nextElementSibling).toHaveTextContent("₱400,000");
  });

  it("keeps an unapproved ceiling and an unagreed price empty rather than showing zero", () => {
    renderNegotiation(null);

    expect(screen.getByText("Final agreed price").nextElementSibling).toHaveTextContent("—");
  });
});

describe("SellFlowPanel second negotiation (SH-6)", () => {
  it("replaces the price-only controls with an agreed-price input bounded by the ceiling", () => {
    renderNegotiation(null);

    expect(screen.getByText("Record second negotiation")).toBeInTheDocument();
    const input = screen.getByLabelText(/^Agreed price/);
    expect(input).toBeInTheDocument();
    // The ceiling is shown as the limit the specialist must stay under.
    expect(screen.getByText(/max ₱415,000/)).toBeInTheDocument();
    // The Agree button does nothing until a price is entered.
    expect(screen.getByRole("button", { name: "Seller agrees" })).toBeDisabled();
    // Refusing needs no price, so it stays available.
    expect(screen.getByRole("button", { name: "Seller refuses" })).toBeEnabled();
  });

  it("warns above the ceiling and still sends the price for the server to judge", () => {
    renderNegotiation(null);
    fireEvent.change(screen.getByLabelText(/^Agreed price/), { target: { value: "416000" } });

    expect(screen.getByText("The agreed price cannot exceed the approved ceiling of ₱415,000.")).toBeInTheDocument();
    // The server re-checks; the panel does not silently clamp the amount.
    expect(screen.getByRole("button", { name: "Seller agrees" })).toBeEnabled();
  });

  it("sends the agreed price, not the ceiling, when the seller accepts", async () => {
    renderNegotiation(null);
    fireEvent.change(screen.getByLabelText(/^Agreed price/), { target: { value: "400000" } });
    fireEvent.click(screen.getByRole("button", { name: "Seller agrees" }));

    await waitFor(() => expect(recordSellerResponse).toHaveBeenCalled());
    const [fd] = vi.mocked(recordSellerResponse).mock.calls[0];
    expect(fd.get("response")).toBe("agreed");
    expect(fd.get("agreed_price")).toBe("400000");
    expect(fd.get("agreed_price")).not.toBe("415000");
  });

  it("no longer offers the recalculated-price input on the issue report form", () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(
      <SellFlowPanel
        transaction={transaction}
        sellDetails={{ offered_amount: 500000, meetup_method: "gce_visit" }}
        documents={[]}
        userRole="marketing_specialist"
        informants={[]}
        data={{
          proposals: [],
          fieldCase: {
            id: "case-1",
            state: "in_progress",
            inspection_outcome: "issue_found",
            issue_description: "Worn clutch",
          },
          issueReport: null,
          expenses: [],
          threadId: null,
          mechanics: [],
        }}
      />,
    );
    // The profitable branch is chosen through the Radix Select, which only opens on a key event in jsdom.
    fireEvent.keyDown(screen.getByLabelText("Is the vehicle still profitable?"), { key: "Enter" });

    expect(screen.getByRole("option", { name: "Still profitable" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Recalculated price/)).not.toBeInTheDocument();
  });

  it("never renders a legacy recalculated price as the offer", () => {
    // SH-6: an old report keeps its figure in history but the panel reads the ceiling and the remarks.
    renderNegotiation(null, 398000);

    expect(screen.queryByText(/Recalculated/)).not.toBeInTheDocument();
  });
});
