import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransactionDocumentsCard } from "./transaction-documents-card";

vi.mock("next/image", () => ({
  // biome-ignore lint/performance/noImgElement: test stand-in for next/image
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const noop = vi.fn().mockResolvedValue(undefined);

const pendingId = {
  id: "id-1",
  document_kind: "valid_id",
  verification_state: "pending",
  is_image: true,
  signed_url: "https://storage.test/signed/id.jpg",
};

function renderCard(
  documents: Record<string, unknown>[],
  overrides: Partial<Parameters<typeof TransactionDocumentsCard>[0]> = {},
) {
  render(
    <TransactionDocumentsCard
      kind="buy"
      userRole="sales_manager"
      documents={documents}
      onUploadDocument={noop}
      onVerifyDocument={noop}
      onRejectDocument={noop}
      {...overrides}
    />,
  );
}

describe("TransactionDocumentsCard (T03 SM1, HA1, HA3)", () => {
  it("lays the documents out in a grid instead of one per row", () => {
    renderCard([
      pendingId,
      { ...pendingId, id: "id-2" },
      { ...pendingId, id: "bill", document_kind: "proof_of_billing" },
    ]);

    expect(screen.getByRole("list", { name: "Customer documents" })).toHaveClass("sm:grid-cols-2", "xl:grid-cols-3");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("links a PDF and never shows a storage path", () => {
    renderCard([
      {
        id: "pdf-1",
        document_kind: "proof_of_billing",
        verification_state: "verified",
        is_image: false,
        signed_url: "https://storage.test/signed/bill.pdf",
      },
    ]);

    expect(screen.getByRole("link", { name: "Open proof of billing" })).toHaveAttribute(
      "href",
      "https://storage.test/signed/bill.pdf",
    );
    expect(screen.queryByText(/private\//)).not.toBeInTheDocument();
  });

  it("opens a document image in a larger view", () => {
    renderCard([pendingId]);

    fireEvent.click(screen.getByRole("button", { name: "Open Valid ID document preview in a larger view" }));

    expect(screen.getByRole("dialog", { name: "Valid ID document preview" })).toBeInTheDocument();
  });

  it("asks what to fix in a modal before requesting a resubmission", async () => {
    const onRejectDocument = vi.fn().mockResolvedValue(undefined);
    renderCard([pendingId], { onRejectDocument });

    fireEvent.click(screen.getByRole("button", { name: "Ask to resubmit Valid ID" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Ask to resubmit" });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("What to fix"), { target: { value: " Blurred photo " } });
    fireEvent.click(confirm);

    await waitFor(() => expect(onRejectDocument).toHaveBeenCalledWith("id-1", "Blurred photo"));
  });

  it("does not offer verification to a role that cannot verify the document", () => {
    renderCard([pendingId], { userRole: "marketing_specialist" });

    expect(screen.queryByRole("button", { name: /Verify/ })).not.toBeInTheDocument();
  });

  it("shows a failed auto-check next to the manual Verify control, which stays available", () => {
    renderCard([{ ...pendingId, auto_check_status: "failed", auto_check_detail: "Name mismatch" }]);

    expect(screen.getByText("Auto-check: failed")).toBeInTheDocument();
    expect(screen.getByText("Name mismatch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify" })).toBeInTheDocument();
  });

  it("shows the manual review fallback, and nothing for documents never auto-checked", () => {
    renderCard([
      { ...pendingId, auto_check_status: "manual_review" },
      { ...pendingId, id: "id-2" },
    ]);

    expect(screen.getAllByText(/Auto-check:/)).toHaveLength(1);
    expect(screen.getByText("Auto-check: needs manual review")).toBeInTheDocument();
  });
});
