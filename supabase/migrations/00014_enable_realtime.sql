-- 00014: Enable Realtime for inquiry messages and attachments
ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiry_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_attachments;
