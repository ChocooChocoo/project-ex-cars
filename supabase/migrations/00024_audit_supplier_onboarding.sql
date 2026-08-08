-- 00024: Audit remediation — supplier onboarding (R-27)
-- - supplier-documents storage bucket + policies
-- - UPDATE policy on supplier_documents so staff can verify/reject documents

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-documents',
  'supplier-documents',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Staff who manage suppliers may upload documents under the supplier's folder.
CREATE POLICY "Staff can upload supplier documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'supplier-documents'
    AND EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'head_accountant')
    )
  );

-- Staff who manage suppliers may read all supplier documents.
CREATE POLICY "Staff can read supplier documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'supplier-documents'
    AND EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'head_accountant')
    )
  );

-- Approved suppliers may read their own documents.
CREATE POLICY "Approved suppliers can read own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'supplier-documents'
    AND EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.account_id = auth.uid()
      AND suppliers.state = 'approved'
      AND (storage.foldername(name))[1] = suppliers.id::text
    )
  );

-- Allow finance staff to update supplier documents (verification flow).
CREATE POLICY "Staff can update supplier documents" ON public.supplier_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'head_accountant')
    )
  );
