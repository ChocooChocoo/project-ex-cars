import z from "zod";

export const staffTableSchema = z.object({
  id: z.string(),
  fullName: z.string().nullable(),
  role: z.string().nullable(),
  accountState: z.string(),
  joined: z.string(),
  schedule: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  workdays: z.array(z.number()).nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  graceMinutes: z.number().nullable(),
});

export type StaffTableRow = z.infer<typeof staffTableSchema>;
