import { z } from "zod";

export const vehicleSchema = z.object({
  stock_code: z.string().min(1, "Stock code is required.").max(50, "Stock code must be at most 50 characters."),
  vin: z.string().max(50).optional().or(z.literal("")),
  make: z.string().min(1, "Make is required.").max(100),
  model: z.string().min(1, "Model is required.").max(100),
  year: z.coerce.number().int().min(1900, "Year must be 1900 or later.").max(2100),
  condition: z.string().min(1).max(50),
  mileage: z.coerce.number().int().min(0, "Mileage cannot be negative.").optional(),
  fuel_type: z.string().max(50).optional().or(z.literal("")),
  transmission: z.string().max(50).optional().or(z.literal("")),
  exterior_color: z.string().max(50).optional().or(z.literal("")),
  interior_color: z.string().max(50).optional().or(z.literal("")),
  body_type: z.string().max(50).optional().or(z.literal("")),
  engine: z.string().max(200).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  current_price: z.coerce.number().min(0, "Price cannot be negative.").optional(),
  pricing_type: z.enum(["negotiable", "fixed"]),
  warranty_details: z.string().max(500).optional().or(z.literal("")),
  offer_details: z.string().max(500).optional().or(z.literal("")),
});

export type VehicleFormData = z.infer<typeof vehicleSchema>;

export const priceProposalSchema = z.object({
  vehicle_id: z.string().uuid(),
  proposed_amount: z.coerce.number().min(0, "Amount cannot be negative."),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const inspectionSchema = z.object({
  vehicle_id: z.string().uuid(),
  condition_score: z.coerce.number().int().min(0).max(100).optional(),
  findings: z.string().max(2000).optional().or(z.literal("")),
  recommendation: z.string().max(2000).optional().or(z.literal("")),
});

export const checklistNodeSchema = z.object({
  parent_id: z.string().uuid().optional().or(z.literal("")),
  level: z.enum(["system", "component", "part"]),
  name: z.string().min(1, "Name is required.").max(200),
  display_order: z.coerce.number().int().min(0).default(0),
});

export const checklistAnswerSchema = z.object({
  checklist_entry_id: z.string().uuid(),
  status: z.enum(["good", "for_repair", "for_replacement"]),
  notes: z.string().max(500).optional().or(z.literal("")),
  item_name: z.string().max(200).optional().or(z.literal("")),
  brand: z.string().max(100).optional().or(z.literal("")),
  estimated_cost: z.coerce.number().min(0).optional(),
});

export const contentItemSchema = z.object({
  content_kind: z.enum(["hero", "promotion", "featured_vehicle"]),
  vehicle_id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().min(1, "Title is required.").max(200),
  body: z.string().max(5000).optional().or(z.literal("")),
});
