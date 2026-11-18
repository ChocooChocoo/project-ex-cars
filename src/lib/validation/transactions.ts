import { z } from "zod";

import { FINANCING_TERM_MONTHS } from "@/lib/transactions/buy-flow";
import { SELL_MEETUP_METHODS } from "@/lib/transactions/sell-flow";
import { PURCHASE_PAYMENT_METHODS } from "@/lib/transactions/state-machine";
import { OLDEST_LISTED_YEAR, SELL_CONDITION_VALUES } from "@/lib/vehicles/catalog";

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
    if (["meetup", "delivery"].includes(data.arrangement_kind ?? "") && !data.location?.trim()) {
      ctx.addIssue({ code: "custom", path: ["location"], message: "Enter a location for meet-up or delivery." });
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
    // T12: the meet-up point on the map, required for Meet Halfway.
    meetup_lat: z.coerce.number().min(-90).max(90).optional(),
    meetup_lng: z.coerce.number().min(-180).max(180).optional(),
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
  });

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
