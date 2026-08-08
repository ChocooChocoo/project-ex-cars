-- 00028: Audit remediation — customer-side purchase document uploads (G16)
-- Storage policies for the transaction-documents bucket so the buying customer can
-- upload their two valid IDs and proof of billing, and staff can read them.

-- Customers may upload into the folder of a transaction they own.
CREATE POLICY "Customers can upload transaction documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'transaction-documents'
    AND EXISTS (
      SELECT 1 FROM public.transactions
      WHERE transactions.id = (storage.foldername(name))[1]::uuid
      AND transactions.customer_id = auth.uid()
    )
  );

-- Customers may read files in their own transaction folder.
CREATE POLICY "Customers can read own transaction documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'transaction-documents'
    AND EXISTS (
      SELECT 1 FROM public.transactions
      WHERE transactions.id = (storage.foldername(name))[1]::uuid
      AND transactions.customer_id = auth.uid()
    )
  );

-- Staff involved in sales may read all transaction documents.
CREATE POLICY "Staff can read transaction documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'transaction-documents'
    AND EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'account_manager', 'head_accountant')
    )
  );
