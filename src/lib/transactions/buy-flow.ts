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

// §3 Meet Halfway: Cash paid at an agreed Calabarzon location; these requests queue per car.
export function isHalfwayCashRequest(
  details: { payment_method?: unknown; arrangement_kind?: unknown } | null,
): boolean {
  return details?.payment_method === "cash" && details?.arrangement_kind === "meetup";
}

export const NO_SHOW_WAIT_MINUTES = 150;

// §3 step 6: a buyer counts as a no-show only after 2 hours 30 minutes past the meet-up time.
export function canRecordNoShow(schedule: string | Date, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(schedule).getTime() + NO_SHOW_WAIT_MINUTES * 60 * 1000;
}

export interface Standing {
  no_show_count: number;
  strike_count: number;
  gce_visit_only: boolean;
}

export const NO_SHOW_LIMIT = 2;

// Appendix C: 2 no-shows, or any Not Legit decline (a strike), restrict the buyer to GCE Visit only.
export function nextStanding(current: Standing | null, event: "no_show" | "strike"): Standing {
  const base = current ?? { no_show_count: 0, strike_count: 0, gce_visit_only: false };
  if (event === "strike") return { ...base, strike_count: base.strike_count + 1, gce_visit_only: true };
  const noShows = base.no_show_count + 1;
  return { ...base, no_show_count: noShows, gce_visit_only: base.gce_visit_only || noShows >= NO_SHOW_LIMIT };
}

// §4 Delivery: Cash, delivered to the buyer's address; these requests queue like Meet Halfway.
export function isDeliveryCashRequest(
  details: { payment_method?: unknown; arrangement_kind?: unknown } | null,
): boolean {
  return details?.payment_method === "cash" && details?.arrangement_kind === "delivery";
}

// Meet Halfway and Delivery share the Active / On Hold queue and the condition acknowledgment.
export function isQueuedCashRequest(details: { payment_method?: unknown; arrangement_kind?: unknown } | null): boolean {
  return isHalfwayCashRequest(details) || isDeliveryCashRequest(details);
}

export const DOWNPAYMENT_WORKING_DAYS = 3;

// §4 step 5a: "within 2–3 working days". Weekends are skipped.
// ponytail: public holidays are not skipped; add a holiday list if the deadline must honour them.
export function addWorkingDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const weekday = result.getDay();
    if (weekday !== 0 && weekday !== 6) added++;
  }
  return result;
}

export const DELIVERY_STATUSES = ["dispatched", "in_transit", "arriving", "delivered"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  dispatched: "Dispatched",
  in_transit: "In Transit",
  arriving: "Arriving",
  delivered: "Delivered",
};

// §4 step 7a: Dispatched → In Transit → Arriving → Delivered, one step at a time.
export function nextDeliveryStatus(current: DeliveryStatus | null): DeliveryStatus | null {
  if (current === null) return "dispatched";
  return DELIVERY_STATUSES[DELIVERY_STATUSES.indexOf(current) + 1] ?? null;
}

type PaymentLike = { payment_kind: unknown; amount: unknown; verified_by: unknown };

// Verified total of one kind of payment (delivery fee, downpayment, ...).
export function verifiedPaid(payments: PaymentLike[], kind: string): number {
  return payments.filter((p) => p.payment_kind === kind && p.verified_by).reduce((sum, p) => sum + Number(p.amount), 0);
}

// §6 In-House Financing: the buyer visits GCE to inspect before any downpayment. These requests queue too.
export function isFinancingVisitRequest(
  details: { payment_method?: unknown; arrangement_kind?: unknown } | null,
): boolean {
  return details?.payment_method === "financing" && details?.arrangement_kind === "gce_visit";
}

// Every request that joins the per-car Active / On Hold queue.
export function isQueuedRequest(details: { payment_method?: unknown; arrangement_kind?: unknown } | null): boolean {
  return isQueuedCashRequest(details) || isFinancingVisitRequest(details);
}

// Q5 default (§6 step 24, "4–5 months"): repossession may start from the 4th missed installment.
export const MISSED_INSTALLMENTS_BEFORE_REPOSSESSION = 4;

type InstallmentLike = { state: unknown; due_date: unknown };

// Installments past their due date and still unpaid.
export function missedInstallments(installments: InstallmentLike[], today: Date = new Date()): number {
  const day = today.toISOString().slice(0, 10);
  return installments.filter((i) => !["paid", "waived"].includes(String(i.state)) && String(i.due_date) < day).length;
}

// §6 step 25: every installment paid or waived.
export function financingFullyPaid(installments: InstallmentLike[]): boolean {
  return installments.length > 0 && installments.every((i) => ["paid", "waived"].includes(String(i.state)));
}
