import { describe, expect, it } from "vitest";

import { attachmentError, attachmentMimeType } from "./attachments";

const HEIC_ERROR = "HEIC is not supported, please send JPG or PNG.";

describe("attachmentMimeType", () => {
  it("keeps the browser type when there is one", () => {
    expect(attachmentMimeType({ name: "scan.jpg", type: "application/pdf" })).toBe("application/pdf");
  });

  it("infers the type from the extension when the browser gives none", () => {
    expect(attachmentMimeType({ name: "Photo.JPG", type: "" })).toBe("image/jpeg");
    expect(attachmentMimeType({ name: "photo.jpeg", type: "" })).toBe("image/jpeg");
    expect(attachmentMimeType({ name: "shot.png", type: "" })).toBe("image/png");
    expect(attachmentMimeType({ name: "shot.webp", type: "" })).toBe("image/webp");
    expect(attachmentMimeType({ name: "or-cr.pdf", type: "" })).toBe("application/pdf");
  });

  it("returns an empty type for unknown extensions", () => {
    expect(attachmentMimeType({ name: "notes.txt", type: "" })).toBe("");
    expect(attachmentMimeType({ name: "noextension", type: "" })).toBe("");
  });
});

describe("attachmentError", () => {
  it("accepts a JPG or PDF with no browser type", () => {
    expect(attachmentError({ name: "photo.jpg", type: "", size: 100 })).toBeNull();
    expect(attachmentError({ name: "doc.pdf", type: "", size: 100 })).toBeNull();
  });

  it("explains that HEIC is not supported, by type or extension", () => {
    expect(attachmentError({ name: "IMG_0001.HEIC", type: "", size: 100 })).toBe(HEIC_ERROR);
    expect(attachmentError({ name: "IMG_0001.heic", type: "image/heic", size: 100 })).toBe(HEIC_ERROR);
    expect(attachmentError({ name: "IMG_0002", type: "image/heif", size: 100 })).toBe(HEIC_ERROR);
  });

  it("still rejects other types", () => {
    expect(attachmentError({ name: "notes.txt", type: "", size: 100 })).toBe("Attach a JPG, PNG, WebP image or a PDF.");
    expect(attachmentError({ name: "a.gif", type: "image/gif", size: 100 })).toBe(
      "Attach a JPG, PNG, WebP image or a PDF.",
    );
  });
});
