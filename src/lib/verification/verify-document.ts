import { createAdminClient } from "@/lib/supabase/admin";

// Server only: reads provider API keys from the environment. Import it only from server actions.

export type VerifiableKind = "orcr" | "valid_id";
export type AutoCheckStatus = "verified" | "failed" | "manual_review";
export type AutoCheckResult = { status: AutoCheckStatus; provider: string | null; detail: string | null };

type ProviderInput = { kind: VerifiableKind; path: string; idType?: string | null; apiKey: string | null };
export type VerificationProvider = (
  input: ProviderInput,
) => Promise<{ status: "verified" | "failed"; detail?: string }>;

// ponytail: no provider adapters yet. Add one here, keyed by the env value, once the Technical Adviser names it.
const PROVIDERS: Record<string, VerificationProvider> = {};

const ENV = {
  orcr: { provider: "ORCR_VERIFY_PROVIDER", apiKey: "ORCR_VERIFY_API_KEY" },
  valid_id: { provider: "ID_VERIFY_PROVIDER", apiKey: "ID_VERIFY_API_KEY" },
} as const;

/** Checks one document with the configured provider. Any gap or failure means a person reviews it. */
export async function verifyDocument(
  kind: VerifiableKind,
  file: { path: string; idType?: string | null },
  providers: Record<string, VerificationProvider> = PROVIDERS,
): Promise<AutoCheckResult> {
  const name = process.env[ENV[kind].provider]?.trim();
  if (!name) return { status: "manual_review", provider: null, detail: "No verification service is set up." };

  const provider = providers[name];
  if (!provider) return { status: "manual_review", provider: name, detail: "Unknown verification service." };

  try {
    const result = await provider({ kind, ...file, apiKey: process.env[ENV[kind].apiKey]?.trim() || null });
    return { status: result.status, provider: name, detail: result.detail ?? null };
  } catch (error) {
    console.error(`Document verification via ${name} failed`, error);
    return { status: "manual_review", provider: name, detail: "The verification service did not answer." };
  }
}

/** Runs the check and saves it on the document row. Never throws: the customer's submission does not depend on it. */
export async function autoCheckDocument(
  transactionId: string,
  storagePath: string,
  kind: VerifiableKind,
  idType?: string | null,
) {
  try {
    const result = await verifyDocument(kind, { path: storagePath, idType });
    const { error } = await createAdminClient()
      .from("transaction_documents")
      .update({
        auto_check_status: result.status,
        auto_check_provider: result.provider,
        auto_check_detail: result.detail,
        auto_checked_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId)
      .eq("storage_path", storagePath);
    if (error) console.error("Saving the document auto-check failed", error);
  } catch (error) {
    console.error("Document auto-check failed", error);
  }
}
