// T12: what a buyer prepares for each payment method and receiving method. Pure, no I/O.

import { DELIVERY_LEAD_DAYS, FINANCING_TERM_MONTHS } from "./buy-flow";

export const BUYING_PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash", detail: "Pay the whole price in cash." },
  { value: "bank_transfer", label: "Bank Transfer (via PayMongo)", detail: "Pay the whole price online." },
  { value: "financing", label: "In-House Financing", detail: "Pay monthly over 6 to 60 months." },
] as const;

export const BUYING_RECEIVING_OPTIONS = [
  { value: "gce_visit", label: "GCE Visit", detail: "Pick up the car at the GCE office." },
  { value: "meetup", label: "Meet Halfway (CALABARZON)", detail: "Meet GCE at an agreed place in CALABARZON." },
  { value: "delivery", label: "Delivery", detail: "GCE brings the car to your address." },
] as const;

export type BuyingPayment = (typeof BUYING_PAYMENT_OPTIONS)[number]["value"];
export type BuyingReceiving = (typeof BUYING_RECEIVING_OPTIONS)[number]["value"];

export type BuyingRequirements = { documents: string[]; information: string[] };

// SN-15: GCE asks for two printed back-to-back copies of each ID, each copy signed three times.
const BASE_DOCUMENTS = [
  "Two different valid IDs. Bring the originals and two printed back-to-back photocopies of each ID, each copy signed three times.",
  "One recent proof of billing in your name (electric, water or internet bill).",
  "Your latest payslip.",
];

const PAYMENT: Record<BuyingPayment, BuyingRequirements> = {
  cash: { documents: [], information: ["The full price in cash, paid when you receive the car"] },
  bank_transfer: {
    documents: [],
    information: ["The full price, paid online through PayMongo checkout before the car is handed over"],
  },
  financing: {
    documents: [],
    information: [
      `Your payment term: ${FINANCING_TERM_MONTHS.join(", ")} months`,
      "The initial downpayment, paid after you inspect and accept the car",
      "GCE also checks your payslip during the financing review.",
    ],
  },
};

const RECEIVING: Record<BuyingReceiving, BuyingRequirements> = {
  gce_visit: {
    documents: [],
    information: ["A visit slot at the GCE office, on the hour, 9 AM to 9 PM, Monday to Saturday"],
  },
  meetup: {
    documents: [],
    information: [
      "The meet-up location, within CALABARZON only",
      "Your acknowledgment of the car's condition and 360° view",
    ],
  },
  delivery: {
    documents: [],
    information: [
      "Your complete delivery address",
      `A delivery date at least ${DELIVERY_LEAD_DAYS} days after your request`,
      "The delivery fee",
      "Your agreement to the delivery terms",
      "Your acknowledgment of the car's condition and 360° view",
    ],
  },
};

/** The documents and information GCE needs for one payment method and one receiving method. */
export function buyingRequirements(payment: BuyingPayment, receiving: BuyingReceiving): BuyingRequirements {
  return {
    documents: [...BASE_DOCUMENTS, ...PAYMENT[payment].documents, ...RECEIVING[receiving].documents],
    information: [...PAYMENT[payment].information, ...RECEIVING[receiving].information],
  };
}
