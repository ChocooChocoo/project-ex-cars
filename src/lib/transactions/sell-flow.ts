// Pure rules for the Selling Scenario (GCE Process Flows §1). No I/O.

import { buyerIdsComplete } from "./buy-flow";

// T10: the OR and the CR are separate papers; "orcr" is the old combined upload, still accepted.
export const SELL_PAPER_KINDS = [
  "valid_id",
  "orcr",
  "official_receipt",
  "certificate_of_registration",
  "deed_of_sale",
] as const;

export const SELL_MEETUP_METHODS = ["meet_halfway", "gce_visit"] as const;
export type SellMeetupMethod = (typeof SELL_MEETUP_METHODS)[number];

export const SELL_MEETUP_METHOD_LABELS: Record<SellMeetupMethod, string> = {
  meet_halfway: "Meet Halfway within Calabarzon",
  gce_visit: "GCE Visit",
};

export const CEILING_PROPOSAL_KINDS = ["purchase_ceiling", "revised_ceiling"] as const;

export const PROPOSAL_KIND_LABELS: Record<string, string> = {
  purchase_ceiling: "Purchase ceiling",
  revised_ceiling: "Revised ceiling",
  selling_price: "Selling price",
  reprice: "Reprice",
};

type DocumentLike = { document_kind: unknown; verification_state: unknown; id_type?: unknown; id_side?: unknown };

// Step 2: two valid IDs (front and back, like the buyer's), the OR and the CR, and the deed of sale must all
// be verified before a ceiling is proposed. An offer sent before T10 has one combined ORCR and one-sided IDs.
export function sellPapersVerified(documents: DocumentLike[]): boolean {
  const verifiedDocs = documents.filter((doc) => doc.verification_state === "verified");
  const verified = (kind: string) => verifiedDocs.filter((doc) => doc.document_kind === kind).length;
  const orAndCr =
    verified("orcr") >= 1 || (verified("official_receipt") >= 1 && verified("certificate_of_registration") >= 1);
  return buyerIdsComplete(verifiedDocs) && orAndCr && verified("deed_of_sale") >= 1;
}

// T10: the seller sees only high-level statuses. Ceilings, CEO decisions and the staff-only profitability note
// stay internal; only notes written for the seller are shown.
export const CUSTOMER_SELL_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  completed: "Completed",
};

const SELLER_NOTE_PREFIXES = ["Price agreed at", "Seller agreed to the revised price", "Sell transaction created"];
const VERIFICATION_REJECT = "Rejected at verification: ";

/** The part of a sell history reason the seller may read, or null when it is internal. */
export function sellerSafeNote(reason: unknown): string | null {
  if (typeof reason !== "string") return null;
  if (reason.startsWith(VERIFICATION_REJECT)) return reason.slice(VERIFICATION_REJECT.length);
  return SELLER_NOTE_PREFIXES.some((prefix) => reason.startsWith(prefix)) ? reason : null;
}

type ProposalLike = { proposal_kind: unknown; decision: unknown; proposed_amount: unknown; created_at: unknown };

// The negotiating limit: the newest CEO-approved purchase or revised ceiling.
export function approvedCeiling(proposals: ProposalLike[]): number | null {
  const approved = proposals
    .filter(
      (p) => p.decision === "approved" && (CEILING_PROPOSAL_KINDS as readonly unknown[]).includes(p.proposal_kind),
    )
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return approved.length > 0 ? Number(approved[0].proposed_amount) : null;
}
