import { z } from "zod";

import { FINANCING_TERM_MONTHS } from "@/lib/transactions/buy-flow";
import { isInCalabarzon } from "@/lib/transactions/meetup-area";
import { SELL_MEETUP_METHODS } from "@/lib/transactions/sell-flow";
import { PURCHASE_PAYMENT_METHODS } from "@/lib/transactions/state-machine";
import { OLDEST_LISTED_YEAR, SELL_CONDITION_VALUES, SELL_PAPER_STATUSES } from "@/lib/vehicles/catalog";

const OUTSIDE_CALABARZON = "Meet-ups must be inside CALABARZON.";
const PAPERS_MISSING = "Answer the papers checklist for the OR, the CR and the deed of sale.";
export const SIGNED_ID_COPIES_MESSAGE = "Confirm that you will bring the signed copies of your valid IDs.";

// SH-14 / BH-8: a meet-up pin is only valid inside the CALABARZON box. The geocoded region check needs the
// network, so it runs on the map; the box is the part the schema can prove from the coordinates alone.
function outsideCalabarzon(point: { meetup_lat?: number | null; meetup_lng?: number | null }): boolean {
  return (
    point.meetup_lat != null &&
    point.meetup_lng != null &&
    !isInCalabarzon({ lat: point.meetup_lat, lng: point.meetup_lng })
  );
}

// SN-13: the checklist travels as one JSON form field, as `condition_items` does; a typed object passes through.
function parsedChecklist(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export const buyTransactionSchema = z.object({
  vehicle_id: z.string().uuid(),
});

export type BuyTransactionFormData = z.infer<typeof buyTransactionSchema>;

export const buyDetailsSchema = z
  .object({
    transaction_id: z.string().uuid(),
    // T04 P5: Full Payment or Financing. Older forms send only the method; the option then follows it.
    payment_option: z.enum(["full", "financing"]).optional().or(z.literal("")),
    payment_method: z.enum(PURCHASE_PAYMENT_METHODS, {
      error: "Select a payment method.",
    }),
    arrangement_kind: z.enum(["delivery", "meetup", "gce_visit"]).optional().or(z.literal("")),
    schedule: z.string().optional().or(z.literal("")),
    location: z.string().trim().max(500).optional().or(z.literal("")),
    // BH-8: a Meet Halfway meet-up is a map pin inside CALABARZON, not a PSGC address. Delivery keeps the
    // address fields, so `location` is still what delivery and the older rows send.
    meetup_lat: z.coerce.number().min(-90).max(90).optional(),
    meetup_lng: z.coerce.number().min(-180).max(180).optional(),
    meetup_address: z.string().trim().max(500).optional().or(z.literal("")),
    notes: z.string().max(500).optional().or(z.literal("")),
    // §3 step 3: "I have reviewed this car's condition and intend to purchase it as shown."
    acknowledge_condition: z.literal("yes").optional().or(z.literal("")),
    // The delivery terms notice: a fee and a downpayment are paid first.
    agree_delivery_terms: z.literal("yes").optional().or(z.literal("")),
    // Financing: the term the buyer asks for (6 months to 5 years).
    requested_term_months: z.coerce
      .number()
      .refine((months) => (FINANCING_TERM_MONTHS as readonly number[]).includes(months), "Choose a payment term.")
      .optional()
      .or(z.literal("")),
    // T11: how the buyer pays the installments. Saved rows from before T11 have no value, so it is optional;
    // it is only required when the buyer explicitly picked Financing in this save.
    financing_pay_method: z
      .enum(["cash", "paymongo"], { error: "Choose how you will pay the installments." })
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    // Delivery keeps the PSGC address; a meet-up is the CALABARZON pin instead.
    if (data.arrangement_kind === "delivery" && !data.location?.trim()) {
      ctx.addIssue({ code: "custom", path: ["location"], message: "Enter a location for delivery." });
    }
    if (data.arrangement_kind === "meetup") {
      if (data.meetup_lat == null || data.meetup_lng == null) {
        ctx.addIssue({ code: "custom", path: ["meetup_lat"], message: "Set the meet-up point on the map." });
      } else if (outsideCalabarzon(data)) {
        ctx.addIssue({ code: "custom", path: ["meetup_lat"], message: OUTSIDE_CALABARZON });
      }
      // The API stores the composed address as the meet-up location, so an empty one is a 422 there; catch it
      // here instead so the buyer sees it inline rather than as a server toast.
      if (!data.meetup_address?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["meetup_address"],
          message: "Type the block, lot or landmark of the meet-up point.",
        });
      }
    }
    if (data.payment_option === "financing" && !data.financing_pay_method) {
      ctx.addIssue({
        code: "custom",
        path: ["financing_pay_method"],
        message: "Choose Cash or PayMongo for the financing.",
      });
    }
  });

export type BuyDetailsFormData = z.infer<typeof buyDetailsSchema>;

export const sellVehicleSchema = z
  .object({
    make: z.string().trim().min(1, "Brand is required.").max(100),
    model: z.string().trim().min(1, "Model is required.").max(100),
    // T12: the year is typed, so negative and decimal values are rejected here as well as in the input.
    year: z.coerce
      .number({ error: "Enter the year." })
      .int("Enter a whole year, without decimals.")
      .min(OLDEST_LISTED_YEAR, `Enter a year from ${OLDEST_LISTED_YEAR} onward.`)
      .max(new Date().getFullYear() + 1, "The year cannot be in the future."),
    mileage: z.coerce.number().int().min(0, "Mileage cannot be negative."),
    condition: z.enum(SELL_CONDITION_VALUES, { error: "Choose the condition." }),
    condition_detail: z.string().max(1000).optional().or(z.literal("")),
    offered_amount: z.coerce.number().min(0, "Amount cannot be negative."),
    description: z.string().max(2000).optional().or(z.literal("")),
    has_known_issues: z.enum(["yes", "no"], { error: "Declare the vehicle's issues, or that it has no known issue." }),
    declared_issues: z.string().trim().max(2000).optional().or(z.literal("")),
    meetup_method: z.enum(SELL_MEETUP_METHODS, { error: "Choose a meet-up method." }),
    // T12: the meet-up point on the map, required for Meet Halfway and only valid inside CALABARZON.
    meetup_lat: z.coerce.number().min(-90).max(90).optional(),
    meetup_lng: z.coerce.number().min(-180).max(180).optional(),
    // BH-8: the composed Region/Province/City/Barangay + typed block and lot. Optional: a failed lookup must
    // never block the offer.
    meetup_address: z.string().trim().max(500).optional().or(z.literal("")),
    // SN-13: the seller's answers about the OR, the CR and the deed of sale. The papers stay with the seller; the
    // originals are checked at the meet-up, so no photo of them is asked for. The form sends the answers as JSON,
    // like `condition_items`, so the string is decoded before the object is checked.
    papers_checklist: z.preprocess(
      parsedChecklist,
      z.object(
        {
          official_receipt: z.enum(SELL_PAPER_STATUSES),
          certificate_of_registration: z.enum(SELL_PAPER_STATUSES),
          deed_of_sale: z.enum(SELL_PAPER_STATUSES),
        },
        { error: PAPERS_MISSING },
      ),
    ),
    // Notes line 116: the seller must confirm the signed ID copies before the offer is sent. The checkbox reaches
    // this schema as a boolean while the form is typed, but as the "yes" the FormData carries when the payload is
    // re-checked on submit, so both shapes must satisfy it.
    signed_id_copies: z.preprocess(
      (value) => value === true || ["yes", "true", "on"].includes(String(value).trim().toLowerCase()),
      z.literal(true, { error: SIGNED_ID_COPIES_MESSAGE }),
    ),
    // C10: 1st, 2nd, 3rd, or 4 for "4th owner or more".
    owner_number: z.enum(["1", "2", "3", "4"], { error: "Choose which owner you are." }).transform(Number),
  })
  .refine((data) => data.has_known_issues === "no" || !!data.declared_issues, {
    message: "Tick the issues, or tick Others and describe them.",
    path: ["declared_issues"],
  })
  .refine((data) => data.meetup_method !== "meet_halfway" || (data.meetup_lat != null && data.meetup_lng != null), {
    message: "Set the meet-up point on the map.",
    path: ["meetup_lat"],
  })
  .refine((data) => !outsideCalabarzon(data), { message: OUTSIDE_CALABARZON, path: ["meetup_lat"] });

export type SellVehicleFormData = z.infer<typeof sellVehicleSchema>;

export const paymentRecordSchema = z.object({
  transaction_id: z.string().uuid(),
  installment_id: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().min(0, "Amount cannot be negative."),
  method: z.enum(["cash", "financing", "bank_transfer"]),
  external_reference: z.string().max(100).optional().or(z.literal("")),
  settlement_date: z.string().min(1, "Settlement date is required."),
  payment_kind: z
    .enum(["full", "delivery_fee", "downpayment", "balance", "reschedule_fee", "installment"])
    .optional()
    .or(z.literal("")),
});

export type PaymentRecordFormData = z.infer<typeof paymentRecordSchema>;

export const transitionSchema = z.object({
  id: z.string().uuid(),
  to_state: z.enum(["pending", "under_review", "approved", "rejected", "completed", "cancelled"]),
  reason: z.string().max(500).optional().or(z.literal("")),
});

export type TransitionFormData = z.infer<typeof transitionSchema>;
