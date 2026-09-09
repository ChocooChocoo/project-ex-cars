import z from "zod";

export const supplierOfferingSchema = z.enum(["vehicle", "parts", "both"]);

export type SupplierOffering = z.infer<typeof supplierOfferingSchema>;

export const supplierRowSchema = z.object({
  id: z.string(),
  business_name: z.string(),
  supplier_kind: z.string(),
  supplier_offering: supplierOfferingSchema,
  state: z.string(),
  contact_name: z.string(),
  contact_email: z.string(),
  contact_phone: z.string(),
  created_at: z.string(),
});

export type SupplierRow = z.infer<typeof supplierRowSchema>;
