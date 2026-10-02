const TRANSACTION_DOCUMENTS_BUCKET = "transaction-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Customer uploads go browser -> storage; the bucket enforces the same 5 MB cap (00055).
export const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;
export const DOCUMENT_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

type TransactionDocument = Record<string, unknown> & { storage_path?: unknown };

export type SignedTransactionDocument = Omit<TransactionDocument, "storage_path"> & {
  is_image: boolean;
  signed_url: string | null;
};

type TransactionDocumentStorage = {
  from: (bucket: string) => {
    createSignedUrl: (
      path: string,
      expiresIn: number,
    ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
  };
};

export async function withSignedTransactionDocumentUrls(
  storage: TransactionDocumentStorage,
  documents: TransactionDocument[],
): Promise<SignedTransactionDocument[]> {
  const bucket = storage.from(TRANSACTION_DOCUMENTS_BUCKET);

  return Promise.all(
    documents.map(async (document) => {
      const { storage_path: storagePathValue, ...safeDocument } = document;
      const storagePath = typeof storagePathValue === "string" ? storagePathValue : null;
      const isImage = isTransactionDocumentImage(storagePath);
      if (!storagePath) return { ...safeDocument, is_image: isImage, signed_url: null };

      try {
        const { data, error } = await bucket.createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
        return { ...safeDocument, is_image: isImage, signed_url: error ? null : (data?.signedUrl ?? null) };
      } catch {
        return { ...safeDocument, is_image: isImage, signed_url: null };
      }
    }),
  );
}

export function isTransactionDocumentImage(storagePath: unknown): boolean {
  return typeof storagePath === "string" && /\.(?:jpe?g|png|webp)$/i.test(storagePath);
}

export function transactionDocumentLabel(documentKind: unknown): string {
  const label = typeof documentKind === "string" ? documentKind.replace(/_/g, " ") : "document";
  if (label === "valid id") return "Valid ID";
  if (label === "orcr") return "ORCR";
  return label.charAt(0).toUpperCase() + label.slice(1);
}
