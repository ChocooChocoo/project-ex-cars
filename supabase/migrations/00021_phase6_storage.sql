-- 00021: Phase 6 — Storage for security duty evidence and report attachments
-- Private bucket: only Head Security (own uploads) and CEO oversight can access.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('security-evidence', 'security-evidence', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('report-evidence', 'report-evidence', false, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Head Security can upload own evidence" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'security-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Head Security can read own evidence" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'security-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "CEO can read security evidence" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'security-evidence'
    AND EXISTS (
      SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
      AND active = true AND role = 'ceo'
    )
  );

CREATE POLICY "Report authors can upload evidence" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'report-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Report authors and finance roles can read report evidence" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'report-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
        AND active = true AND role IN ('ceo', 'head_accountant')
      )
    )
  );
