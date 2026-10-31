import { z } from "zod";

import { FINANCING_TERM_MONTHS } from "@/lib/transactions/buy-flow";
import { SELL_MEETUP_METHODS } from "@/lib/transactions/sell-flow";
import { PURCHASE_PAYMENT_METHODS } from "@/lib/transactions/state-machine";
import { VEHICLE_PURPOSES } from "@/lib/vehicles/catalog";

export const buyTransactionSchema = z.object({
  vehicle_id: z.string().uuid(),
});

export type BuyTransactionFormData = z.infer<typeof buyTransactionSchema>;

export const buyDetailsSchema = z.object({
  transaction_id: z.string().uuid(),
  // T04 P5: Full Payment or Financing. Older forms send only the method; the option then follows it.
  payment_option: z.enum(["full", "financing"]).optional().or(z.literal("")),
  payment_method: z.enum(PURCHASE_PAYMENT_METHODS, {
    error: "Select a payment method.",
  }),
  arrangement_kind: z.enum(["delivery", "meetup", "gce_visit"]).optional().or(z.literal("")),
  schedule: z.string().optional().or(z.literal("")),
  location: z.string().max(500).optional().or(z.literal("")),
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
});

export type BuyDetailsFormData = z.infer<typeof buyDetailsSchema>;

export const sellVehicleSchema = z
  .object({
    make: z.string().trim().min(1, "Brand is required.").max(100),
    model: z.string().trim().min(1, "Model is required.").max(100),
    year: z.coerce.number({ error: "Choose the year." }).int().min(1900, "Choose the year.").max(2100),
    mileage: z.coerce.number().int().min(0, "Mileage cannot be negative."),
    condition: z
      .enum(["excellent", "good", "fair", "needs_repair"])
      .transform((val) => {
        const map: Record<string, string> = {
          excellent: "Excellent",
          good: "Good",
          fair: "Fair",
          needs_repair: "Needs Repair",
        };
        return map[val] ?? val;
      })
      .or(
        z
          .string()
          .trim()
          .toLowerCase()
          .transform((val) => {
            const map: Record<string, string> = {
              excellent: "Excellent",
              good: "Good",
              fair: "Fair",
              needs_repair: "Needs Repair",
              "needs repair": "Needs Repair",
              needsrepair: "Needs Repair",
            };
            if (map[val]) return map[val];
            const cleaned = val.trim();
            if (!cleaned) return cleaned;
            return cleaned
              .split(/[\s_]+/)
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(" ");
          })
          .pipe(z.string().min(1, "Condition is required.").max(50)),
      ),
    condition_detail: z.string().max(1000).optional().or(z.literal("")),
    offered_amount: z.coerce.number().min(0, "Amount cannot be negative."),
    description: z.string().max(2000).optional().or(z.literal("")),
    has_known_issues: z.enum(["yes", "no"], { error: "Declare the vehicle's issues, or that it has no known issue." }),
    declared_issues: z.string().trim().max(2000).optional().or(z.literal("")),
    meetup_method: z.enum(SELL_MEETUP_METHODS, { error: "Choose a meet-up method." }),
    // C10: 1st, 2nd, 3rd, or 4 for "4th owner or more".
    owner_number: z.enum(["1", "2", "3", "4"], { error: "Choose which owner you are." }).transform(Number),
  })
  .refine((data) => data.has_known_issues === "no" || !!data.declared_issues, {
    message: "Tick the issues, or tick Others and describe them.",
    path: ["declared_issues"],
  });

export type SellVehicleFormData = z.infer<typeof sellVehicleSchema>;

export const requestCarSchema = z
  .object({
    requested_make: z.string().trim().min(1, "Brand is required.").max(100),
    requested_model: z.string().trim().min(1, "Model is required.").max(100),
    purpose: z.enum(VEHICLE_PURPOSES).optional().or(z.literal("")),
    year_min: z.coerce.number().int().min(1900).optional(),
    year_max: z.coerce.number().int().min(1900).optional(),
    budget: z.coerce.number().min(0, "Budget cannot be negative."),
    other_preferences: z.string().max(1000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.year_min && data.year_max && data.year_min > data.year_max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum year cannot be greater than maximum year.",
        path: ["year_min"],
      });
    }
  });

export type RequestCarFormData = z.infer<typeof requestCarSchema>;

export const paymentRecordSchema = z.object({
  transaction_id: z.string().uuid(),
  installment_id: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().min(0, "Amount cannot be negative."),
  method: z.enum(["cash", "financing", "bank_transfer"]),
  external_reference: z.string().max(100).optional().or(z.literal("")),
  settlement_date: z.string().min(1, "Settlement date is required."),
  payment_kind: z
    .enum(["full", "delivery_fee", "downpayment", "balance", "reschedule_fee"])
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
