import { createAdminClient } from "@/lib/supabase/admin";

import { MESSAGE_ATTACHMENTS_BUCKET, type SignedAttachment } from "./attachments";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Signs attachment rows the caller has already read under RLS (the read proves access).
 * The storage path never reaches the browser.
 */
export async function signAttachments(rows: Record<string, unknown>[]): Promise<SignedAttachment[]> {
  if (rows.length === 0) return [];
  const bucket = createAdminClient().storage.from(MESSAGE_ATTACHMENTS_BUCKET);
  return Promise.all(
    rows.map(async ({ storage_path: storagePath, ...row }) => {
      let signedUrl: string | null = null;
      if (typeof storagePath === "string") {
        const { data } = await bucket.createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
        signedUrl = data?.signedUrl ?? null;
      }
      return { ...row, signed_url: signedUrl } as SignedAttachment;
    }),
  );
}

/** Adds signed URLs to the `message_attachments` of each message. */
export async function withSignedMessageAttachments(
  messages: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const rows = messages.flatMap((message) => (message.message_attachments as Record<string, unknown>[] | null) ?? []);
  if (rows.length === 0) return messages;
  const signed = new Map((await signAttachments(rows)).map((attachment) => [attachment.id, attachment]));
  return messages.map((message) => ({
    ...message,
    message_attachments: ((message.message_attachments as Record<string, unknown>[] | null) ?? []).map(
      (row) => signed.get(row.id as string) ?? row,
    ),
  }));
}
