// Pure rules for the buying flows (GCE Process Flows §2 onward). No I/O.

export const BUYER_ID_COUNT = 2;

type DocumentLike = { document_kind: unknown; verification_state: unknown };

// IDs still in play: a rejected ID frees its place so the buyer can upload a replacement.
export function activeBuyerIdCount(documents: DocumentLike[]): number {
  return documents.filter((doc) => doc.document_kind === "valid_id" && doc.verification_state !== "rejected").length;
}

// §7–9 (Phase 6 default, not yet in the source): a bank-transfer purchase follows the same steps as its
// Cash counterpart in §2–4. T04: so does a Full Payment through PayMongo. The "Cash" predicates below cover all three.
export const DIRECT_PAYMENT_METHODS = ["cash", "bank_transfer", "paymongo"] as const;

// T04 P6/P7: financing adds a flat 10% to the car's price, for every term.
export const FINANCING_TERM_MONTHS = [6, 12, 24, 36, 60] as const;

export function financedTotal(price: number): number {
  return Math.round(price * 1.1);
}

export function isDirectPayment(details: { payment_method?: unknown } | null): boolean {
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
  const how = method === "bank_transfer" ? "by bank transfer" : method === "paymongo" ? "through PayMongo" : "in cash";
  return audience === "buyer"
    ? `The balance is paid ${how} on delivery.`
    : `Collect the remaining balance ${how} when the buyer accepts the car.`;
}

// §2 Onsite Visit (§7 by bank transfer): paid in full at GCE.
export function isOnsiteCashRequest(details: { payment_method?: unknown; arrangement_kind?: unknown } | null): boolean {
  return isDirectPayment(details) && details?.arrangement_kind === "gce_visit";
}

// The time a buyer picked in a datetime-local field, as an instant. The minutes are kept: a time off
// the hour is refused with the slot rule, not rounded.
export function pickedTime(local: string): Date | null {
  const when = new Date(local);
  return !local || Number.isNaN(when.getTime()) ? null : when;
}

export const SLOT_RULE_MESSAGE = "Please choose a time on the hour, between 9 AM and 9 PM, Monday to Saturday.";

// Every schedule (visit, meet-up, delivery): on the hour, 9 AM to 9 PM, Monday to Saturday. Read in
// Manila time (UTC+8, no daylight saving), whatever time zone the server runs in.
export function isBusinessSlot(schedule: Date): boolean {
  const manila = new Date(schedule.getTime() + 8 * 60 * 60 * 1000);
  const hour = manila.getUTCHours();
  return (
    manila.getUTCMinutes() === 0 &&
    manila.getUTCSeconds() === 0 &&
    manila.getUTCMilliseconds() === 0 &&
    hour >= 9 &&
    hour <= 21 &&
    manila.getUTCDay() !== 0
  );
}

// A bookable slot: still ahead, and inside GCE's hours. Whole hours keep two bookings from overlapping.
export function isVisitSlot(schedule: Date, now: Date = new Date()): boolean {
  return schedule.getTime() > now.getTime() && isBusinessSlot(schedule);
}

export const DELIVERY_LEAD_DAYS = 7;
export const DELIVERY_LEAD_MESSAGE = "Delivery must be scheduled at least 7 days after your request date.";

// A delivery is booked at least 7 days after the request date.
export function isDeliveryDate(schedule: Date, requestedAt: Date = new Date()): boolean {
  return schedule.getTime() >= requestedAt.getTime() + DELIVERY_LEAD_DAYS * 24 * 60 * 60 * 1000;
}

// §3 Meet Halfway (§8 by bank transfer): paid at an agreed Calabarzon location; these requests queue per car.
export function isHalfwayCashRequest(
  details: { payment_method?: unknown; arrangement_kind?: unknown } | null,
): boolean {
  return isDirectPayment(details) && details?.arrangement_kind === "meetup";
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
  return isDirectPayment(details) && details?.arrangement_kind === "delivery";
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
// A payment the Head Accountant rejected (T03 HA3) never counts.
export function paidTowardPrice(
  payments: { payment_kind?: unknown; amount?: unknown; rejected_at?: unknown }[],
): number {
  return payments
    .filter((p) => !p.rejected_at && p.payment_kind !== "delivery_fee" && p.payment_kind !== "reschedule_fee")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
}

// State an unpaid installment returns to, from its due date (both "YYYY-MM-DD").
export function installmentStateFor(dueDate: string, today: string): "overdue" | "due" | "upcoming" {
  if (dueDate < today) return "overdue";
  return dueDate === today ? "due" : "upcoming";
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

// Vehicle papers (OR/CR, Deed of Sale and related documents) stay with the Confidential Informant
// until a sale. No handover row means the papers are still with the CI.
export const PAPERS_STATUSES = ["requested", "released_to_ci", "handed_over", "received", "returned"] as const;
export type PapersStatus = (typeof PAPERS_STATUSES)[number];

export const PAPERS_STATUS_LABELS: Record<PapersStatus, string> = {
  requested: "Papers Requested",
  released_to_ci: "Papers Released to CI",
  handed_over: "Papers Handed Over",
  received: "Papers Received",
  returned: "Papers Returned to CI",
};

// Meet Halfway and Delivery: the CI carries the papers to the buyer. A GCE visit hands them to the
// Sales Manager instead.
export function isFieldArrangement(details: { arrangement_kind?: unknown } | null): boolean {
  return details?.arrangement_kind === "meetup" || details?.arrangement_kind === "delivery";
}

// "Mark as Sold" waits for the papers: received by the Sales Manager at a GCE visit, or handed to the
// buyer by the CI at a meet-up or delivery.
export function papersReadyForSale(
  details: { arrangement_kind?: unknown } | null,
  handover: { papers_status?: unknown } | null,
): boolean {
  return handover?.papers_status === (isFieldArrangement(details) ? "handed_over" : "received");
}

// Contract (buying-flow revision). A sale at a meet-up, on delivery, or on financing has a contract. It
// is signed before money is recorded, before the papers reach the buyer and before the car is marked sold.
type SaleDetails = { payment_method?: unknown; arrangement_kind?: unknown } | null;

export const CONTRACT_STATES = ["draft", "pending_approval", "returned", "approved", "signed"] as const;
export type ContractState = (typeof CONTRACT_STATES)[number];

export const CONTRACT_STATE_LABELS: Record<ContractState, string> = {
  draft: "Draft",
  pending_approval: "Waiting for Head Accountant",
  returned: "Returned for Revision",
  approved: "Approved, Waiting for Signature",
  signed: "Contract Signed",
};

export function needsContract(details: SaleDetails): boolean {
  return isFieldArrangement(details) || details?.payment_method === "financing";
}

// Financing at a GCE visit or a meet-up: the Sales Manager writes the contract, the Head Accountant
// approves it and the buyer signs it in the app. Everywhere else the buyer signs the printed contract on
// site and the Confidential Informant reports it.
export function signsInApp(details: SaleDetails): boolean {
  return details?.payment_method === "financing" && details.arrangement_kind !== "delivery";
}

type CopiesLike = { ci_copy_at?: unknown; mechanic_copy_at?: unknown } | null;

// Who has not yet recorded keeping a signed copy. The Confidential Informant keeps one in the field; at
// a cash Meet Halfway the Mechanic keeps one too.
export function missingContractCopies(details: SaleDetails, handover: CopiesLike): string[] {
  const missing: string[] = [];
  if (isFieldArrangement(details) && !handover?.ci_copy_at) missing.push("Confidential Informant");
  if (isHalfwayCashRequest(details) && !handover?.mechanic_copy_at) missing.push("Mechanic");
  return missing;
}

export function contractReadyForSale(
  details: SaleDetails,
  handover: ({ contract_state?: unknown } & NonNullable<CopiesLike>) | null,
): boolean {
  if (!needsContract(details)) return true;
  return handover?.contract_state === "signed" && missingContractCopies(details, handover).length === 0;
}

const PRE_DELIVERY_PAYMENT_KINDS: readonly unknown[] = ["delivery_fee", "reschedule_fee", "downpayment"];

// A delivery takes its fee and downpayment before the day, so before the contract is signed on arrival.
// T04 X2: a Cash or Bank Transfer meet-up may also take its downpayment before the contract is signed there.
export function paymentAllowedBeforeSigning(details: SaleDetails, paymentKind: unknown): boolean {
  if (isHalfwayCashRequest(details)) return paymentKind === "downpayment";
  return details?.arrangement_kind === "delivery" && PRE_DELIVERY_PAYMENT_KINDS.includes(paymentKind);
}

const peso = (amount: unknown) => `PHP ${Number(amount ?? 0).toLocaleString("en-PH")}`;

// The pre-made contract the Sales Manager can start from, filled in from the agreed financing terms.
export function contractTemplate(sale: {
  buyer: string;
  vehicle: string;
  price: unknown;
  terms: {
    down_payment?: unknown;
    number_of_payments?: unknown;
    payment_frequency?: unknown;
    first_due_date?: unknown;
  } | null;
}): string {
  const { terms } = sale;
  return [
    "VEHICLE SALE AND IN-HOUSE FINANCING CONTRACT",
    "",
    `Seller: GCE Auto Sales. Buyer: ${sale.buyer}.`,
    `Vehicle: ${sale.vehicle}.`,
    `Vehicle price: ${peso(sale.price)}.`,
    ...(terms
      ? [
          `Downpayment: ${peso(terms.down_payment)}.`,
          `Amount financed: ${peso(Number(sale.price ?? 0) - Number(terms.down_payment ?? 0))}, paid in ${terms.number_of_payments} ${terms.payment_frequency} payments. First payment due ${terms.first_due_date}.`,
        ]
      : []),
    "",
    "The buyer has inspected the vehicle and accepts it in its present condition.",
    "The vehicle stays under this contract until every payment is made. If the payments are not made, GCE will take back the vehicle.",
    "",
    "Signed by the buyer and by GCE Auto Sales.",
  ].join("\n");
}

export type OnlinePayment = { kind: "delivery_fee" | "downpayment"; label: string; amount: number };

// What the buyer pays online: a delivery's fee and downpayment once its terms are set, or the Initial
// Downpayment of a financing claimed at a GCE visit. Everything else is paid in person or in instalments.
export function onlinePaymentsDue(
  details: {
    arrangement_kind?: unknown;
    delivery_fee?: unknown;
    downpayment_amount?: unknown;
    downpayment_due_at?: unknown;
  } | null,
  terms: { down_payment?: unknown; state?: unknown } | null,
  flowStatus: unknown,
): OnlinePayment[] {
  if (details?.arrangement_kind === "delivery" && details.downpayment_due_at) {
    return [
      { kind: "delivery_fee" as const, label: "Delivery Fee", amount: Number(details.delivery_fee ?? 0) },
      { kind: "downpayment" as const, label: "Downpayment", amount: Number(details.downpayment_amount ?? 0) },
    ].filter((payment) => payment.amount > 0);
  }
  if (details?.arrangement_kind === "gce_visit" && terms?.state === "approved" && flowStatus === "purchase_claim") {
    const amount = Number(terms.down_payment ?? 0);
    return amount > 0 ? [{ kind: "downpayment", label: "Downpayment", amount }] : [];
  }
  return [];
}
