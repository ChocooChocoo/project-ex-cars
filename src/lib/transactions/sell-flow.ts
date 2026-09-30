// Pure rules for the Selling Scenario (GCE Process Flows §1). No I/O.

export const SELL_PAPER_KINDS = ["valid_id", "orcr", "deed_of_sale"] as const;

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

type DocumentLike = { document_kind: unknown; verification_state: unknown };

// Step 2: two valid IDs, the ORCR and the deed of sale must all be verified before a ceiling is proposed.
export function sellPapersVerified(documents: DocumentLike[]): boolean {
  const verified = (kind: string) =>
    documents.filter((doc) => doc.document_kind === kind && doc.verification_state === "verified").length;
  return verified("valid_id") >= 2 && verified("orcr") >= 1 && verified("deed_of_sale") >= 1;
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
