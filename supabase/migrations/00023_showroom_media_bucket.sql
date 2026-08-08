-- 00023: R-07 — Public showroom media bucket for vehicle photographs and 360-degree views

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'showroom-media',
  'showroom-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone may read approved public vehicle media.
CREATE POLICY "Public can read showroom media" ON storage.objects
  FOR SELECT USING (bucket_id = 'showroom-media');

-- Marketing and vehicle staff may upload and manage files.
CREATE POLICY "Marketing and vehicle staff can upload showroom media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'showroom-media'
    AND EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist', 'sales_manager', 'account_manager')
    )
  );

CREATE POLICY "Marketing and vehicle staff can update showroom media" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'showroom-media'
    AND EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist', 'sales_manager', 'account_manager')
    )
  );

CREATE POLICY "Marketing and vehicle staff can delete showroom media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'showroom-media'
    AND EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist', 'sales_manager', 'account_manager')
    )
  );
