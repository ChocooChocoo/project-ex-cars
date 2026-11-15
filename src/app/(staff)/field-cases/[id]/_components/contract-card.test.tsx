import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  recordBuyerMet,
  recordContractCopy,
  recordFieldSignatures,
  reportSigning,
} from "@/app/(staff)/transactions/handover-actions";

import { ContractCard } from "./contract-card";

// jsdom has no pointer capture and no canvas backend; the signature pad needs both to be drawable.
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.hasPointerCapture = () => false;

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/transactions/handover-actions", () => ({
  recordBuyerMet: vi.fn(),
  recordContractCopy: vi.fn(),
  recordFieldSignatures: vi.fn(),
  reportSigning: vi.fn(),
}));

const financedDetails = { arrangement_kind: "delivery", payment_method: "financing", final_price: 500000 };
const cashDetails = { arrangement_kind: "delivery", payment_method: "cash", final_price: 500000 };

function drawOn(pad: HTMLElement) {
  fireEvent.pointerDown(pad, { clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.pointerUp(pad, { clientX: 20, clientY: 20, pointerId: 1 });
}

const rendered = () => vi.mocked(recordFieldSignatures);

describe("ContractCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recordBuyerMet).mockResolvedValue({ success: true });
    vi.mocked(reportSigning).mockResolvedValue({ success: true });
    vi.mocked(recordContractCopy).mockResolvedValue({ success: true });
    vi.mocked(recordFieldSignatures).mockResolvedValue({ success: true });
    // jsdom has no canvas backend: stand in so toBlob can answer with a real image blob.
    HTMLCanvasElement.prototype.getContext = (() => ({
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      stroke: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = ((callback: BlobCallback) =>
      callback(new Blob(["signature"], { type: "image/png" }))) as typeof HTMLCanvasElement.prototype.toBlob;
  });

  it("shows the missed payment policy and its print link on a financing buy", () => {
    render(<ContractCard transactionId="tx-1" details={financedDetails} handover={{}} member={null} />);

    expect(screen.getByText("Missed payment policy")).toBeInTheDocument();
    expect(screen.getByText(/Four \(4\) consecutive missed monthly payments|After 4 consecutive/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Print policy" })).toHaveAttribute(
      "href",
      "/vehicle-papers/tx-1/missed-payment-policy",
    );
  });

  it("leaves the policy out of a cash buy", () => {
    render(<ContractCard transactionId="tx-1" details={cashDetails} handover={{}} member={null} />);
    expect(screen.queryByText("Missed payment policy")).not.toBeInTheDocument();
  });

  it("gives the assigned CI the two signature pads and sends both images", async () => {
    render(<ContractCard transactionId="tx-1" details={financedDetails} handover={{}} member="informant" />);

    expect(screen.getByText("Buyer signature")).toBeInTheDocument();
    expect(screen.getByText("Your signature (Confidential Informant)")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Record signatures" });
    expect(button).toBeDisabled();

    const [buyerPad, ciPad] = screen.getAllByLabelText("Signature pad: draw your signature");
    drawOn(buyerPad as HTMLElement);
    expect(button).toBeDisabled();
    drawOn(ciPad as HTMLElement);
    expect(button).toBeEnabled();

    fireEvent.click(button);

    await vi.waitFor(() => expect(recordFieldSignatures).toHaveBeenCalledOnce());

    // T11: the browser no longer uploads to storage itself (the CI has no policy on the bucket); the two PNGs
    // travel in the form and the server stores them.
    const fd = rendered().mock.calls[0]?.[0] as FormData;
    expect(fd.get("transaction_id")).toBe("tx-1");
    const buyer = fd.get("buyer_signature");
    const ci = fd.get("ci_signature");
    expect(buyer).toBeInstanceOf(File);
    expect(ci).toBeInstanceOf(File);
    expect((buyer as File).type).toBe("image/png");
    expect((ci as File).type).toBe("image/png");
  });

  it("shows the signing is done and offers no pads once signed", () => {
    render(
      <ContractCard
        transactionId="tx-1"
        details={financedDetails}
        handover={{ contract_state: "signed" }}
        member="informant"
      />,
    );

    expect(screen.getByText("Signed by the buyer and the Confidential Informant.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record signatures" })).not.toBeInTheDocument();
  });

  it("keeps Record Buyer Met working", () => {
    render(<ContractCard transactionId="tx-1" details={cashDetails} handover={{}} member="informant" />);

    fireEvent.click(screen.getByRole("button", { name: "Record Buyer Met" }));
    expect(recordBuyerMet).toHaveBeenCalledOnce();
  });

  it("keeps Report contract signed working", () => {
    render(
      <ContractCard
        transactionId="tx-1"
        details={cashDetails}
        handover={{ buyer_met_at: "2026-11-01T02:00:00.000Z" }}
        member="informant"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Report contract signed" }));
    expect(reportSigning).toHaveBeenCalledOnce();
  });

  it("keeps Record my signed copy working once the contract is signed", () => {
    render(
      <ContractCard
        transactionId="tx-1"
        details={cashDetails}
        handover={{ buyer_met_at: "2026-11-01T02:00:00.000Z", contract_state: "signed" }}
        member="informant"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Record my signed copy" }));
    expect(recordContractCopy).toHaveBeenCalledOnce();
  });
});
