import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handPapersToBuyer, releasePapersToCi, uploadFieldDocument } from "@/app/(staff)/transactions/handover-actions";
import { compressFormFiles } from "@/lib/uploads/compress-image";

import { PapersCard } from "./papers-card";

Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/transactions/handover-actions", () => ({
  handPapersToBuyer: vi.fn(),
  releasePapersToCi: vi.fn(),
  uploadFieldDocument: vi.fn(),
}));
vi.mock("@/lib/uploads/compress-image", () => ({ compressFormFiles: vi.fn(async (fd: FormData) => fd) }));

const document = {
  id: "doc-1",
  document_kind: "orcr",
  source: "previous_owner" as const,
  label: "ORCR",
  uploaded_at: "2026-10-01T00:00:00.000Z",
  signed_url: "https://example.test/orcr.png",
  is_image: true,
  note: "From the first owner",
};

const base = {
  transactionId: "tx-1",
  papersStatus: null,
  canRecord: false,
  deedHref: "/vehicle-papers/tx-1/deed-of-sale",
};

describe("PapersCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(releasePapersToCi).mockResolvedValue({ success: true });
    vi.mocked(handPapersToBuyer).mockResolvedValue({ success: true });
    vi.mocked(uploadFieldDocument).mockResolvedValue({ success: true });
  });

  it("lists each paper with its source, date and note, and links the deed", () => {
    render(<PapersCard {...base} documents={[document]} canUpload={false} />);

    expect(screen.getByText("ORCR")).toBeInTheDocument();
    expect(screen.getByText("Previous owner · Oct 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("From the first owner")).toBeInTheDocument();
    expect(screen.getByLabelText("Open ORCR preview in a larger view")).toBeInTheDocument();

    const deed = screen.getByRole("link", { name: /GCE Deed of Sale/ });
    expect(deed).toHaveAttribute("href", "/vehicle-papers/tx-1/deed-of-sale");
  });

  it("says so when the sale has no papers yet", () => {
    render(<PapersCard {...base} documents={[]} canUpload={false} />);
    expect(screen.getByText("No papers on file yet.")).toBeInTheDocument();
  });

  it("keeps the upload form away from someone who may not file papers", () => {
    render(<PapersCard {...base} documents={[]} canUpload={false} />);
    expect(screen.queryByRole("heading", { name: "Add document" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Document file")).not.toBeInTheDocument();
  });

  it("uploads a paper with its kind, note and compressed file", async () => {
    render(<PapersCard {...base} documents={[]} canUpload />);

    const file = new File(["pdf"], "orcr.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Document file"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "OR from the owner" } });
    fireEvent.click(screen.getByRole("button", { name: "Add document" }));

    await vi.waitFor(() => expect(uploadFieldDocument).toHaveBeenCalledOnce());
    expect(compressFormFiles).toHaveBeenCalledOnce();
    const fd = vi.mocked(uploadFieldDocument).mock.calls[0]?.[0] as FormData;
    expect(fd.get("transaction_id")).toBe("tx-1");
    // The select keeps OR/CR as its default.
    expect(fd.get("document_kind")).toBe("orcr");
    expect(fd.get("note")).toBe("OR from the owner");
    expect((fd.get("file") as File).name).toBe("orcr.pdf");
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("keeps the release buttons working for the assigned CI", () => {
    render(<PapersCard {...base} papersStatus="released_to_ci" canRecord documents={[]} canUpload={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Hand papers to buyer" }));
    expect(handPapersToBuyer).toHaveBeenCalledOnce();
  });

  it("shows the non-image papers as a file row with an Open link", () => {
    render(
      <PapersCard
        {...base}
        documents={[
          { ...document, is_image: false, label: "Official Receipt (OR)", signed_url: "https://x.test/or.pdf" },
        ]}
        canUpload={false}
      />,
    );

    const row = screen.getByTestId("paper-document-doc-1");
    expect(within(row).queryByRole("img")).not.toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Open" })).toHaveAttribute("href", "https://x.test/or.pdf");
  });
});
