import { describe, expect, it, vi } from "vitest";

import { withSignedTransactionDocumentUrls } from "./document-media";

describe("withSignedTransactionDocumentUrls", () => {
  it("signs private transaction documents for one hour and merges display-only URLs", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.test/signed/photo.jpg?token=secret" },
      error: null,
    });
    const storage = { from: vi.fn(() => ({ createSignedUrl })) };
    const documents = [{ id: "doc-1", storage_path: "transaction-1/photo.jpg", document_kind: "sell_photo" }];

    const result = await withSignedTransactionDocumentUrls(storage, documents);
    expect(result).toEqual([
      {
        id: "doc-1",
        document_kind: "sell_photo",
        is_image: true,
        signed_url: "https://storage.test/signed/photo.jpg?token=secret",
      },
    ]);
    expect(result[0]).not.toHaveProperty("storage_path");
    expect(storage.from).toHaveBeenCalledWith("transaction-documents");
    expect(createSignedUrl).toHaveBeenCalledWith("transaction-1/photo.jpg", 3600);
  });

  it("uses a null display URL when signing fails", async () => {
    const storage = {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: new Error("signing failed") }),
      })),
    };

    const result = await withSignedTransactionDocumentUrls(storage, [
      { id: "doc-1", storage_path: "private/secret.pdf" },
    ]);
    expect(result).toEqual([{ id: "doc-1", is_image: false, signed_url: null }]);
    expect(result[0]).not.toHaveProperty("storage_path");
  });
});
