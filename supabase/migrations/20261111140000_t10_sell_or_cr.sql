-- T10 Phase 7: the seller sends the Official Receipt (OR) and the Certificate of Registration (CR) as two
-- uploads, and each valid ID as a front and a back like the buyer does. Old combined 'orcr' rows stay valid.

BEGIN;

ALTER TABLE public.transaction_documents
  DROP CONSTRAINT IF EXISTS transaction_documents_document_kind_check;

ALTER TABLE public.transaction_documents
  ADD CONSTRAINT transaction_documents_document_kind_check
  CHECK (document_kind IN (
    'valid_id', 'proof_of_billing', 'invoice', 'receipt', 'sale_document', 'sale_certificate',
    'payment_receipt', 'sell_photo', 'orcr', 'official_receipt', 'certificate_of_registration',
    'deed_of_sale', 'inspection_photo', 'expense_proof', 'issue_photo'
  ));

DROP POLICY IF EXISTS "Customers can upload own sell papers" ON public.transaction_documents;

CREATE POLICY "Customers can upload own sell papers"
  ON public.transaction_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND document_kind IN ('valid_id', 'orcr', 'official_receipt', 'certificate_of_registration', 'deed_of_sale')
    AND verification_state = 'pending'
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

COMMIT;
