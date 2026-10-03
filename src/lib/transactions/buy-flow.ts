// Pure rules for the buying flows (GCE Process Flows §2 onward). No I/O.

export const BUYER_ID_COUNT = 2;

type DocumentLike = { document_kind: unknown; verification_state: unknown };

// IDs still in play: a rejected ID frees its place so the buyer can upload a replacement.
export function activeBuyerIdCount(documents: DocumentLike[]): number {
  return documents.filter((doc) => doc.document_kind === "valid_id" && doc.verification_state !== "rejected").length;
}

// §7–9 (Phase 6 default, not yet in the source): a bank-transfer purchase follows the same steps as its
// Cash counterpart in §2–4. The "Cash" predicates below cover both methods.
export const DIRECT_PAYMENT_METHODS = ["cash", "bank_transfer"] as const;

function paysDirect(details: { payment_method?: unknown } | null): boolean {
  return (DIRECT_PAYMENT_METHODS as readonly unknown[]).includes(details?.payment_method);
}

// What a delivery message says about the balance: paid on delivery in cash or by bank transfer, or, for
// In-House Financing (§11), paid later in installments, so the delivery team collects nothing.
export function deliveryBalanceNote(method: unknown, audience: "buyer" | "team"): string {
  if (method === "financing") {
    return audience === "buyer"
      ? "The balance is paid in monthly installments under your financing agreement."
      : "Collect nothing on delivery: the balance is financed by GCE.";
  }
  const how = method === "bank_transfer" ? "by bank transfer" : "in cash";
  return audience === "buyer"
    ? `The balance is paid ${how} on delivery.`
    : `Collect the remaining balance ${how} when the buyer accepts the car.`;
}

// §2 Onsite Visit (§7 by bank transfer): paid in full at GCE.
export function isOnsiteCashRequest(details: { payment_method?: unknown; arrangement_kind?: unknown } | null): boolean {
  return paysDirect(details) && details?.arrangement_kind === "gce_visit";
}

// The time a buyer picked in a datetime-local field, as an instant. GCE visits are whole hours and a
// phone's time picker lets any minute through, so a visit drops its minutes instead of being refused.
export function pickedTime(local: string, arrangementKind: string): Date | null {
  const when = new Date(local);
  if (!local || Number.isNaN(when.getTime())) return null;
  if (arrangementKind === "gce_visit") when.setMinutes(0, 0, 0);
  return when;
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

// §3 Meet Halfway (§8 by bank transfer): paid at an agreed Calabarzon location; these requests queue per car.
export function isHalfwayCashRequest(
  details: { payment_method?: unknown; arrangement_kind?: unknown } | null,
): boolean {
  return paysDirect(details) && details?.arrangement_kind === "meetup";
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

// §4 Delivery (§9 by bank transfer): delivered to the buyer's address; these requests queue like Meet Halfway.
export function isDeliveryCashRequest(
  details: { payment_method?: unknown; arrangement_kind?: unknown } | null,
): boolean {
  return paysDirect(details) && details?.arrangement_kind === "delivery";
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

// What the buyer has paid toward the car itself. The delivery and reschedule fees are charged on top
// of the car price, so they do not reduce it.
export function paidTowardPrice(payments: { payment_kind?: unknown; amount?: unknown }[]): number {
  return payments
    .filter((p) => p.payment_kind !== "delivery_fee" && p.payment_kind !== "reschedule_fee")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
}

// §6 In-House Financing: the buyer inspects the car at a GCE visit before any downpayment. §10 and §11
// (Phase 6 defaults, not yet in the source) swap the visit for a Calabarzon meet-up or a delivery; the
// financing steps are the same. These requests queue too.
export function isFinancingRequest(details: { payment_method?: unknown; arrangement_kind?: unknown } | null): boolean {
  return (
    details?.payment_method === "financing" &&
    ["gce_visit", "meetup", "delivery"].includes(String(details?.arrangement_kind))
  );
}

// Every request that joins the per-car Active / On Hold queue.
export function isQueuedRequest(details: { payment_method?: unknown; arrangement_kind?: unknown } | null): boolean {
  return isQueuedCashRequest(details) || isFinancingRequest(details);
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
