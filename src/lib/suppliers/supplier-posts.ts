// Process & Revision Notes Part 1: a supplier's vehicle post, as SupplierController::pack returns it. No I/O.

export const SUPPLIER_POST_STATES = [
  "posted",
  "proposed",
  "approved",
  "rejected",
  "assigned",
  "purchased",
  "withdrawn",
] as const;

export type SupplierPostState = (typeof SUPPLIER_POST_STATES)[number];

export const SUPPLIER_POST_STATE_LABELS: Record<SupplierPostState, string> = {
  posted: "Posted",
  proposed: "Proposed to the CEO",
  approved: "Approved by the CEO",
  rejected: "Not purchased",
  assigned: "Inspection scheduled",
  purchased: "Purchased by GCE",
  withdrawn: "Withdrawn",
};

/** Posts still in play; the rest are the supplier's history. */
export const ACTIVE_SUPPLIER_POST_STATES: readonly SupplierPostState[] = ["posted", "proposed", "approved", "assigned"];

export interface SupplierPost {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  asking_price: number;
  description: string | null;
  state: SupplierPostState;
  photos: (string | null)[];
  created_at: string | null;
  updated_at: string | null;
  company_name?: string | null;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  // Phase 2: the Marketing Specialist's proposal and the CEO's decision.
  market_value?: number | null;
  proposal_reason?: string | null;
  decision_reason?: string | null;
  thread_id?: string | null;
  // Phase 3: the sell transaction GCE opened to buy it.
  transaction_id?: string | null;
}

export function supplierPostTitle(post: Pick<SupplierPost, "year" | "make" | "model">): string {
  return `${post.year} ${post.make} ${post.model}`;
}

export function isActiveSupplierPost(post: Pick<SupplierPost, "state">): boolean {
  return ACTIVE_SUPPLIER_POST_STATES.includes(post.state);
}
