import { createAdminClient } from "@/lib/supabase/admin";

import { MESSAGE_ATTACHMENTS_BUCKET, type SignedAttachment } from "./attachments";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Signs attachment rows the caller has already read under RLS (the read proves access). Chat attachments are
 * signed by Laravel now (Phase 4); employee-request proofs still use this until Phase 7.
 * The storage path never reaches the browser.
 */
export async function signAttachments(
  rows: Record<string, unknown>[],
  bucket = MESSAGE_ATTACHMENTS_BUCKET,
): Promise<SignedAttachment[]> {
  if (rows.length === 0) return [];
  const storage = createAdminClient().storage.from(bucket);
  return Promise.all(
    rows.map(async ({ storage_path: storagePath, ...row }) => {
      let signedUrl: string | null = null;
      if (typeof storagePath === "string") {
        const { data } = await storage.createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
        signedUrl = data?.signedUrl ?? null;
      }
      return { ...row, signed_url: signedUrl } as SignedAttachment;
    }),
  );
}
