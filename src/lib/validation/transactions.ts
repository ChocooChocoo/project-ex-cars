import { z } from "zod";

export const buyTransactionSchema = z.object({
  vehicle_id: z.string().uuid(),
  payment_method: z.enum(["cash", "financing", "cheque", "down_payment"]),
  final_price: z.coerce.number().min(0, "Price cannot be negative.").optional(),
  arrangement_kind: z.enum(["delivery", "meetup", "gce_visit"]).optional().or(z.literal("")),
  schedule: z.string().optional().or(z.literal("")),
  location: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type BuyTransactionFormData = z.infer<typeof buyTransactionSchema>;

export const sellVehicleSchema = z.object({
  make: z.string().min(1, "Make is required.").max(100),
  model: z.string().min(1, "Model is required.").max(100),
  year: z.coerce.number().int().min(1900).max(2100),
  mileage: z.coerce.number().int().min(0, "Mileage cannot be negative."),
  condition: z.string().min(1).max(50),
  offered_amount: z.coerce.number().min(0, "Amount cannot be negative."),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export type SellVehicleFormData = z.infer<typeof sellVehicleSchema>;

export const requestCarSchema = z
  .object({
    requested_make: z.string().min(1, "Make is required.").max(100),
    requested_model: z.string().min(1, "Model is required.").max(100),
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
  method: z.enum(["cash", "financing", "cheque", "bank_transfer"]),
  external_reference: z.string().max(100).optional().or(z.literal("")),
  settlement_date: z.string().min(1, "Settlement date is required."),
});

export type PaymentRecordFormData = z.infer<typeof paymentRecordSchema>;

export const paymentTermsSchema = z.object({
  purchase_transaction_id: z.string().uuid(),
  arrangement_description: z.string().min(1, "Description is required.").max(500),
  total_amount: z.coerce.number().min(0, "Total amount cannot be negative."),
  down_payment: z.coerce.number().min(0, "Down payment cannot be negative.").default(0),
  number_of_payments: z.coerce.number().int().min(1, "Must have at least 1 payment.").max(60),
  payment_frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly"]),
  first_due_date: z.string().min(1, "First due date is required."),
});

export type PaymentTermsFormData = z.infer<typeof paymentTermsSchema>;

export const transitionSchema = z.object({
  id: z.string().uuid(),
  to_state: z.enum(["pending", "under_review", "approved", "rejected", "completed", "cancelled"]),
  reason: z.string().max(500).optional().or(z.literal("")),
});

export type TransitionFormData = z.infer<typeof transitionSchema>;

export const reviewSellSchema = z.object({
  transaction_id: z.string().uuid(),
  valuation_amount: z.coerce.number().min(0, "Valuation cannot be negative."),
  decision: z.enum(["accepted", "rejected"]),
  review_notes: z.string().max(2000).optional().or(z.literal("")),
});

export type ReviewSellFormData = z.infer<typeof reviewSellSchema>;
