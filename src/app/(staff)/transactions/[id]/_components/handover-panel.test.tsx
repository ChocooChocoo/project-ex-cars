import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContractCard } from "./handover-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/signature-pad", () => ({ SignaturePad: () => null }));

function renderMeetup(signingMethod: string, userRole = "sales_manager") {
  render(
    <ContractCard
      transactionId="tx-1"
      details={{ arrangement_kind: "meetup", payment_method: "financing" }}
      handover={{ contract_state: "signed", signing_method: signingMethod }}
      template=""
      open
      userRole={userRole}
    />,
  );
}

describe("ContractCard", () => {
  it("offers the Sales Manager a countersignature after a meet-up buyer e-signs", () => {
    renderMeetup("e_signature");

    expect(screen.getByRole("button", { name: "Sign for GCE" })).toBeDisabled();
  });

  it("does not offer a countersignature when the contract is signed on paper", () => {
    renderMeetup("face_to_face");

    expect(screen.queryByRole("button", { name: "Sign for GCE" })).not.toBeInTheDocument();
  });

  it("does not offer a countersignature to the Head Accountant", () => {
    renderMeetup("e_signature", "head_accountant");

    expect(screen.queryByRole("button", { name: "Sign for GCE" })).not.toBeInTheDocument();
  });
});
