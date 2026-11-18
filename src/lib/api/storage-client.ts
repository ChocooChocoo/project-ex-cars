"use client";

import { browserApi } from "./client";
import { errorMessage } from "./errors";

/**
 * Phase 5: drop-in for the two Supabase Storage calls the customer forms make (`upload` and `uploadToSignedUrl`
 * on the transaction-documents bucket). The file goes to Laravel, which checks that the key is one this customer
 * may write (their own transaction's folder, or a key granted by prepareSellUploads) before storing it.
 */
type UploadResult = { data: { path: string } | null; error: { message: string } | null };

async function send(path: string, file: Blob, token?: string): Promise<UploadResult> {
  const body = new FormData();
  body.set("path", path);
  if (token) body.set("token", token);
  body.set("file", file, path.split("/").pop());
  try {
    await browserApi("POST", "/api/v1/trading/uploads", body);
    return { data: { path }, error: null };
  } catch (error) {
    return { data: null, error: { message: errorMessage(error) } };
  }
}

export function createClient() {
  return {
    storage: {
      from(_bucket: "transaction-documents") {
        return {
          upload: (path: string, file: Blob, _options?: unknown) => send(path, file),
          uploadToSignedUrl: (path: string, token: string, file: Blob, _options?: unknown) => send(path, file, token),
        };
      },
    },
  };
}
