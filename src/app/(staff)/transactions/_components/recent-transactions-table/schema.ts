import z from "zod";

export const transactionRowSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  kind: z.string(),
  state: z.string(),
  paymentMethod: z.string(),
  vehicleMake: z.string(),
  vehicleModel: z.string(),
  vehicleYear: z.string(),
  openedAt: z.string(),
  paidInstallments: z.number().optional(),
  totalInstallments: z.number().optional(),
});

export type TransactionRow = z.infer<typeof transactionRowSchema>;
