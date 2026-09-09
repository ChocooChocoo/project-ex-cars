-- 00040: Task 32 — sell condition checklist + sell-photo documents
-- Additive only. Stores the optional customer condition parts/issues checklist on
-- sell_details and widens the transaction_documents kind check to cover
-- sell-vehicle photo attachments (verified uploads, same verification states).

ALTER TABLE public.sell_details
  ADD COLUMN IF NOT EXISTS condition_items JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.transaction_documents
    DROP CONSTRAINT IF EXISTS transaction_documents_document_kind_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.transaction_documents
  ADD CONSTRAINT transaction_documents_document_kind_check
  CHECK (document_kind IN ('valid_id', 'proof_of_billing', 'invoice', 'receipt', 'sale_document', 'sale_certificate', 'payment_receipt', 'sell_photo'));
