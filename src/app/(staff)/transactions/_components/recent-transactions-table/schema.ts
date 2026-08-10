import z from "zod";

export const transactionRowSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  kind: z.string(),
  state: z.string(),
  vehicleMake: z.string(),
  vehicleModel: z.string(),
  vehicleYear: z.string(),
  openedAt: z.string(),
});

export type TransactionRow = z.infer<typeof transactionRowSchema>;
