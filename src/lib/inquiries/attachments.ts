// T03 C16: chat attachments go browser -> storage on a signed URL, so the 4 MB Server Action body
// limit does not apply. The bucket (migration 20261026130000) enforces the same size and types.
export const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments";
// T06: staff request proofs follow the chat attachment rules on their own bucket.
export const REQUEST_ATTACHMENTS_BUCKET = "request-attachments";
export const REQUEST_ATTACHMENT_MAX_COUNT = 3;
export const MESSAGE_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;
export const MESSAGE_ATTACHMENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
// Extensions too, so the picker still offers files whose type the OS does not report.
export const MESSAGE_ATTACHMENT_ACCEPT = [
  ...Object.keys(MESSAGE_ATTACHMENT_TYPES),
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
].join(",");

export type AttachmentMeta = { name: string; type: string; size: number };

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/** The browser's type, or one inferred from the extension when the browser leaves it empty (some OS/file pickers do). */
export function attachmentMimeType(file: Pick<AttachmentMeta, "name" | "type">): string {
  return file.type || EXTENSION_TYPES[extensionOf(file.name)] || "";
}

/** Null when the file can be sent, otherwise the message to show. Shared by the browser and the server. */
export function attachmentError(file: AttachmentMeta): string | null {
  if (/^image\/hei[cf]$/.test(file.type) || /^hei[cf]$/.test(extensionOf(file.name))) {
    return "HEIC is not supported, please send JPG or PNG.";
  }
  if (!MESSAGE_ATTACHMENT_TYPES[attachmentMimeType(file)]) return "Attach a JPG, PNG, WebP image or a PDF.";
  if (file.size <= 0) return "This file is empty.";
  if (file.size > MESSAGE_ATTACHMENT_MAX_SIZE) return "Files must be 10 MB or smaller.";
  if (!file.name.trim() || file.name.length > 200) return "Rename the file to under 200 characters.";
  return null;
}

export type SignedAttachment = Record<string, unknown> & {
  id: string;
  message_id: string;
  original_name: string;
  file_kind: "image" | "file";
  file_size: number | null;
  signed_url: string | null;
};
