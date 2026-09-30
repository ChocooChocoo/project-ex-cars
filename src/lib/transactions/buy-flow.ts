// Pure rules for the buying flows (GCE Process Flows §2 onward). No I/O.

export const BUYER_ID_COUNT = 2;

type DocumentLike = { document_kind: unknown; verification_state: unknown };

// IDs still in play: a rejected ID frees its place so the buyer can upload a replacement.
export function activeBuyerIdCount(documents: DocumentLike[]): number {
  return documents.filter((doc) => doc.document_kind === "valid_id" && doc.verification_state !== "rejected").length;
}

// §2 Onsite Visit: Cash paid in person at GCE.
export function isOnsiteCashRequest(details: { payment_method?: unknown; arrangement_kind?: unknown } | null): boolean {
  return details?.payment_method === "cash" && details?.arrangement_kind === "gce_visit";
}

// Visit slots are whole hours, so two bookings cannot overlap by a few minutes.
export function isVisitSlot(schedule: Date, now: Date = new Date()): boolean {
  return (
    !Number.isNaN(schedule.getTime()) &&
    schedule.getTime() > now.getTime() &&
    schedule.getMinutes() === 0 &&
    schedule.getSeconds() === 0 &&
    schedule.getMilliseconds() === 0
  );
}
