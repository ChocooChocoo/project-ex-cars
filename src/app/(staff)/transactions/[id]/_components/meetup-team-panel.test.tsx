import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(staff)/transactions/delivery-actions", () => ({ createMeetupFieldCase: vi.fn() }));

import { MeetupTeamPanel } from "./meetup-team-panel";

const informant = { id: "11111111-1111-4111-8111-111111111111", full_name: "Informant One" };
const mechanic = { id: "22222222-2222-4222-8222-222222222222", full_name: "Mechanic One" };

function renderPanel(overrides: Partial<Parameters<typeof MeetupTeamPanel>[0]> = {}) {
  render(
    <MeetupTeamPanel
      transactionId="33333333-3333-4333-8333-333333333333"
      mode="approval"
      paymentMethod="bank_transfer"
      finalPrice={600000}
      informants={[informant]}
      mechanics={[mechanic]}
      pick={{}}
      onPick={vi.fn()}
      fieldCase={null}
      waitingFor={null}
      {...overrides}
    />,
  );
}

describe("MeetupTeamPanel commitment downpayment (BH-6)", () => {
  it("shows the downpayment as 10% of the price, read-only", () => {
    renderPanel();

    expect(screen.getByText("Commitment downpayment (10% of the price)")).toBeInTheDocument();
    expect(screen.getByText(/₱60,000/)).toBeInTheDocument();
    // Nothing to type: the amount is the fixed 10% and the server decides it.
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("states the price is needed before the downpayment can be shown", () => {
    renderPanel({ finalPrice: 0 });

    expect(screen.getByText("Set the vehicle price first")).toBeInTheDocument();
    expect(
      screen.getByText("Set the vehicle price before approving: the downpayment is 10% of it."),
    ).toBeInTheDocument();
  });

  it("still hides the team pickers for a bank-transfer meet-up approved with its downpayment", () => {
    renderPanel();

    // The pickers ride along with the approval in "assign"; here the downpayment is the only input.
    expect(screen.getByRole("combobox", { name: "Confidential Informant" }).closest(".hidden")).not.toBeNull();
    expect(
      screen.getByText("Approve the request. The buyer then pays the downpayment through PayMongo."),
    ).toBeInTheDocument();
  });

  it("keeps the team pickers for a cash meet-up", () => {
    renderPanel({ paymentMethod: "cash" });

    expect(screen.getByRole("combobox", { name: "Confidential Informant" }).closest(".hidden")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Mechanic" }).closest(".hidden")).toBeNull();
    expect(screen.queryByText("Commitment downpayment (10% of the price)")).not.toBeInTheDocument();
    expect(screen.getByText("The request cannot be approved until both are chosen.")).toBeInTheDocument();
  });

  it("names the team in the assign mode and offers no downpayment there", () => {
    renderPanel({ mode: "assign", paymentMethod: "financing" });

    expect(screen.getByRole("combobox", { name: "Confidential Informant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign team and send the command" })).toBeDisabled();
    expect(screen.queryByText("Commitment downpayment (10% of the price)")).not.toBeInTheDocument();
  });
});
