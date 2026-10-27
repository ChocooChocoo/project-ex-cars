import { createAdminClient } from "@/lib/supabase/admin";

// Server only: reads provider API keys from the environment. Import it only from server actions.

export type VerifiableKind = "orcr" | "valid_id";
export type AutoCheckStatus = "verified" | "failed" | "manual_review";
export type AutoCheckResult = { status: AutoCheckStatus; provider: string | null; detail: string | null };

type ProviderInput = { kind: VerifiableKind; path: string; idType?: string | null; apiKey: string | null };
export type VerificationProvider = (
  input: ProviderInput,
) => Promise<{ status: "verified" | "failed"; detail?: string }>;

// Words printed on an LTO Official Receipt / Certificate of Registration.
const ORCR_MARKERS = [
  "LAND TRANSPORTATION OFFICE",
  "CERTIFICATE OF REGISTRATION",
  "OFFICIAL RECEIPT",
  "PLATE",
  "CHASSIS",
  "ENGINE",
  "MV FILE",
];

/** Decides from the OCR text whether the upload looks like an OR/CR. It does not prove the paper is genuine. */
export function judgeOrcrText(text: string): { status: "verified" | "failed"; detail: string } {
  const upper = text.toUpperCase();
  const found = ORCR_MARKERS.filter((marker) => upper.includes(marker));
  // ponytail: keyword match only, compare plate/chassis with the listing once the sell form asks for them.
  if (found.length >= 3) return { status: "verified", detail: `Looks like an OR/CR (found: ${found.join(", ")}).` };
  return { status: "failed", detail: "The text does not look like an LTO OR/CR." };
}

// Words printed on each accepted ID type (keys match ACCEPTED_ID_TYPES).
const ID_MARKERS: Record<string, string[]> = {
  passport: ["PASAPORTE", "PASSPORT"],
  drivers_license: ["DRIVER'S LICENSE", "DRIVERS LICENSE", "LAND TRANSPORTATION OFFICE"],
  umid: ["UNIFIED MULTI-PURPOSE", "UMID"],
  sss_id: ["SOCIAL SECURITY SYSTEM", "SSS"],
  gsis_id: ["GOVERNMENT SERVICE INSURANCE", "GSIS"],
  philhealth_id: ["PHILHEALTH", "PHILIPPINE HEALTH INSURANCE"],
  voters_id: ["COMMISSION ON ELECTIONS", "COMELEC", "VOTER"],
  national_id: ["PAMBANSANG PAGKAKAKILANLAN", "PHILIPPINE IDENTIFICATION", "PHILSYS"],
  prc_id: ["PROFESSIONAL REGULATION COMMISSION"],
  postal_id: ["PHILPOST", "POSTAL"],
};

/** Decides from the OCR text whether the upload looks like the chosen ID type. It does not prove the ID is genuine. */
export function judgeIdText(text: string, idType?: string | null): { status: "verified" | "failed"; detail: string } {
  const upper = text.toUpperCase();
  const markers = (idType ? ID_MARKERS[idType] : undefined) ?? Object.values(ID_MARKERS).flat();
  const found = markers.filter((marker) => upper.includes(marker));
  // ponytail: keyword match only, compare the name with the buyer's profile if staff want a stronger check.
  if (found.length > 0) return { status: "verified", detail: `Looks like the chosen ID (found: ${found.join(", ")}).` };
  return { status: "failed", detail: "The text does not match the chosen ID type." };
}

/** OCR.space free API: reads the text from a short-lived signed URL of the upload. */
const ocrSpace: VerificationProvider = async ({ kind, path, idType, apiKey }) => {
  if (!apiKey) throw new Error("The OCR.space API key is not set");

  const { data, error } = await createAdminClient().storage.from("transaction-documents").createSignedUrl(path, 120);
  if (error || !data) throw new Error(`Could not sign the upload: ${error?.message}`);

  const body = new FormData();
  body.set("apikey", apiKey);
  body.set("url", data.signedUrl);
  body.set("OCREngine", "2");
  body.set("scale", "true");
  if (path.toLowerCase().endsWith(".pdf")) body.set("filetype", "PDF");

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`OCR.space answered ${response.status}`);
  const json = (await response.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[];
    ParsedResults?: { ParsedText?: string }[];
  };
  if (json.IsErroredOnProcessing) throw new Error(`OCR.space error: ${[json.ErrorMessage].flat().join(" ")}`);

  const text = (json.ParsedResults ?? []).map((result) => result.ParsedText ?? "").join(" ");
  return kind === "orcr" ? judgeOrcrText(text) : judgeIdText(text, idType);
};

const PROVIDERS: Record<string, VerificationProvider> = { ocrspace: ocrSpace };

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
