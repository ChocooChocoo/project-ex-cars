import z from "zod";

export const supplierRowSchema = z.object({
  id: z.string(),
  business_name: z.string(),
  supplier_kind: z.string(),
  state: z.string(),
  contact_name: z.string(),
  contact_email: z.string(),
  contact_phone: z.string(),
  created_at: z.string(),
});

export type SupplierRow = z.infer<typeof supplierRowSchema>;
