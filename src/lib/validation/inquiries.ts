import { z } from "zod";

export const createInquirySchema = z.object({
  vehicle_id: z.string().uuid(),
  intention_kind: z.enum(["inquiry", "buy_now"]).optional().or(z.literal("")),
});

export type CreateInquiryFormData = z.infer<typeof createInquirySchema>;

export const sendMessageSchema = z.object({
  inquiry_id: z.string().uuid(),
  message_text: z.string().max(2000).optional().or(z.literal("")),
});

export type SendMessageFormData = z.infer<typeof sendMessageSchema>;

export const scheduleArrangementSchema = z.object({
  inquiry_id: z.string().uuid(),
  arrangement_kind: z.enum(["delivery", "meetup", "gce_visit"]),
  schedule: z.string().min(1, "Schedule is required."),
  location: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type ScheduleArrangementFormData = z.infer<typeof scheduleArrangementSchema>;
