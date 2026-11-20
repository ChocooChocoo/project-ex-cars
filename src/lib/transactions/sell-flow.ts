// Pure rules for the Selling Scenario (GCE Process Flows §1). No I/O.

import { buyerIdsComplete } from "./buy-flow";

// T10: the OR and the CR are separate papers; "orcr" is the old combined upload, still accepted. SN-11: only the
// valid IDs are verified in the app now; a new offer declares the OR/CR/Deed on the checklist and staff inspect the
// originals on site, so the older upload kinds stay readable without being required.
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

export type LatLng = { lat: number; lng: number };

/** GCE's office: plus code 8XG3+XC8 (7Q62 area), Dominador Mangubat Blvd, Dasmariñas, Cavite. Same point as the
 * attendance geofence in `backend/app/Services/Staff/Attendance.php`. */
export const GCE_LOCATION: LatLng = { lat: 14.32741, lng: 120.95359 };

export const GCE_LOCATION_LABEL = "GCE, 8XG3+XC8, Dominador Mangubat Blvd, Dasmariñas, Cavite";

// ponytail: straight-line average of the two points, accurate enough inside CALABARZON. Use a driving-route
// midpoint (a routing API) if the panel needs travel time to be equal on both sides.
export function halfwayPoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export const CEILING_PROPOSAL_KINDS = ["purchase_ceiling", "revised_ceiling"] as const;

export const PROPOSAL_KIND_LABELS: Record<string, string> = {
  purchase_ceiling: "Purchase ceiling",
  revised_ceiling: "Revised ceiling",
  selling_price: "Selling price",
  reprice: "Reprice",
};

type DocumentLike = { document_kind: unknown; verification_state: unknown; id_type?: unknown; id_side?: unknown };

// Step 2 (SN-11): only the two valid IDs, front and back, must be verified before a ceiling is proposed. The OR,
// the CR and the deed of sale are declared on the seller's checklist and inspected on site, so an offer that still
// carries them is not blocked and an offer that never sends them is not either.
export function sellPapersVerified(documents: DocumentLike[]): boolean {
  return buyerIdsComplete(documents.filter((doc) => doc.verification_state === "verified"));
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

// SH-6: "Seller agreed to the negotiated price" is the price the seller accepted, not the ceiling, so it is safe.
const SELLER_NOTE_PREFIXES = [
  "Price agreed at",
  "Seller agreed to the negotiated price",
  "Seller agreed to the revised price",
  "Sell transaction created",
];
const VERIFICATION_REJECT = "Rejected at verification: ";

/** The part of a sell history reason the seller may read, or null when it is internal. */
export function sellerSafeNote(reason: unknown): string | null {
  if (typeof reason !== "string") return null;
  if (reason.startsWith(VERIFICATION_REJECT)) return reason.slice(VERIFICATION_REJECT.length);
  return SELLER_NOTE_PREFIXES.some((prefix) => reason.startsWith(prefix)) ? reason : null;
}

type ProposalLike = { proposal_kind: unknown; decision: unknown; proposed_amount: unknown; created_at: unknown };

/**
 * ₱415,000 or ₱415,000.50 — the shape the server's peso() prints, so a limit quoted in the UI reads exactly like
 * the message the same limit produces in an API error.
 */
export function pesoAmount(amount: number): string {
  const hasCents = Math.round((amount % 1) * 100) !== 0;
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: hasCents ? 2 : 0 })}`;
}

/** The newest CEO-approved proposal of one ceiling kind, so the facts grid can label each separately. */
export function approvedCeilingOfKind(proposals: ProposalLike[], kind: (typeof CEILING_PROPOSAL_KINDS)[number]) {
  const approved = proposals
    .filter((p) => p.decision === "approved" && p.proposal_kind === kind)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return approved.length > 0 ? Number(approved[0].proposed_amount) : null;
}

// The negotiating limit: the newest CEO-approved purchase or revised ceiling. A revised ceiling supersedes the
// purchase ceiling it replaced, so it wins even when both rows share a timestamp.
export function approvedCeiling(proposals: ProposalLike[]): number | null {
  const approved = proposals
    .filter(
      (p) => p.decision === "approved" && (CEILING_PROPOSAL_KINDS as readonly unknown[]).includes(p.proposal_kind),
    )
    .sort((a, b) => {
      const byDate = String(b.created_at).localeCompare(String(a.created_at));
      if (byDate !== 0) return byDate;
      const revised = (p: { proposal_kind: unknown }) => (p.proposal_kind === "revised_ceiling" ? 1 : 0);
      return revised(b) - revised(a);
    });
  return approved.length > 0 ? Number(approved[0].proposed_amount) : null;
}
