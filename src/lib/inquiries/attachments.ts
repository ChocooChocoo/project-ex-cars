// T03 C16: chat attachments go browser -> storage on a signed URL, so the 4 MB Server Action body
// limit does not apply. The bucket (migration 20261026130000) enforces the same size and types.
export const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments";
export const MESSAGE_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;
export const MESSAGE_ATTACHMENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const MESSAGE_ATTACHMENT_ACCEPT = Object.keys(MESSAGE_ATTACHMENT_TYPES).join(",");

export type AttachmentMeta = { name: string; type: string; size: number };

/** Null when the file can be sent, otherwise the message to show. Shared by the browser and the server. */
export function attachmentError(file: AttachmentMeta): string | null {
  if (!MESSAGE_ATTACHMENT_TYPES[file.type]) return "Attach a JPG, PNG, WebP image or a PDF.";
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
