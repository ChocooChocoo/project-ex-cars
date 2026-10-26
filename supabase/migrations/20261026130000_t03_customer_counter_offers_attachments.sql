-- T03 Phase 9.
-- C13: remarks GCE writes for the seller when it counters their price after an inspection issue.
-- C16: chat attachments. The bucket never existed, and the attachment rules left out the Marketing Specialist
-- and Sales Manager, who read their threads through their own message rules.
-- Timestamped name so it runs after every existing migration on a fresh reset.

ALTER TABLE public.inspection_issue_reports ADD COLUMN IF NOT EXISTS seller_remarks TEXT;

-- Private bucket. The app signs upload and download URLs on the server after checking the thread,
-- so no storage.objects policy is needed for browsers.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Whoever can read a message can read its attachments: the subquery runs under the caller's own
-- inquiry_messages rules (participants, CEO, Account Manager, Sales Manager, Marketing Specialist).
DROP POLICY IF EXISTS "Participants can read attachments" ON public.message_attachments;
CREATE POLICY "Participants can read attachments"
  ON public.message_attachments FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inquiry_messages AS m WHERE m.id = message_attachments.message_id));

-- Only the sender of a message attaches files to it.
DROP POLICY IF EXISTS "Participants can upload attachments" ON public.message_attachments;
CREATE POLICY "Participants can upload attachments"
  ON public.message_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.inquiry_messages AS m
      WHERE m.id = message_attachments.message_id AND m.sender_id = auth.uid()
    )
  );
