-- T03 Phase 8: customer form fields.
-- C1/C5: purpose of the vehicle on listings and car requests.
-- C10: which owner the seller is (1st, 2nd, 3rd, 4th or more).
-- C9: optional photos of the declared issues on a sell offer.
-- Timestamped name so it runs after every existing migration on a fresh reset.

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE public.vehicle_requests ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE public.sell_details
  ADD COLUMN IF NOT EXISTS owner_number SMALLINT CHECK (owner_number >= 1);

ALTER TABLE public.transaction_documents
  DROP CONSTRAINT IF EXISTS transaction_documents_document_kind_check;

ALTER TABLE public.transaction_documents
  ADD CONSTRAINT transaction_documents_document_kind_check
  CHECK (document_kind IN (
    'valid_id', 'proof_of_billing', 'invoice', 'receipt', 'sale_document', 'sale_certificate',
    'payment_receipt', 'sell_photo', 'orcr', 'deed_of_sale', 'inspection_photo', 'expense_proof',
    'issue_photo'
  ));

-- Issue photos are attachments like sell photos: the seller adds them to their own sell offer,
-- they land verified and stay inside the transaction's storage folder.
DROP POLICY IF EXISTS "Customers can upload own issue photos" ON public.transaction_documents;

CREATE POLICY "Customers can upload own issue photos"
  ON public.transaction_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND document_kind = 'issue_photo'
    AND verification_state = 'verified'
    AND EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE transactions.id = transaction_documents.transaction_id
        AND transactions.customer_id = auth.uid()
        AND transactions.transaction_kind = 'sell'
    )
    AND (
      storage_path IS NULL
      OR storage_path LIKE transaction_documents.transaction_id::text || '/%'
    )
  );
