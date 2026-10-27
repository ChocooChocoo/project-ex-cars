-- T04 Phase 3 (client change requests batch 2, P4–P7).
-- - purchase_details.payment_option: Full Payment or Financing. Financing keeps payment_method = 'financing',
--   so existing financing rules still read the method.
-- - Cheque is no longer offered: existing cheque rows become bank transfers.
-- - Full Payment can be made through PayMongo.
-- - Financing terms: 6, 12, 24, 36 or 60 months.

ALTER TABLE public.purchase_details
  ADD COLUMN IF NOT EXISTS payment_option TEXT CHECK (payment_option IN ('full', 'financing'));

UPDATE public.purchase_details
  SET payment_option = CASE WHEN payment_method = 'financing' THEN 'financing' ELSE 'full' END
  WHERE payment_option IS NULL;

UPDATE public.purchase_details SET payment_method = 'bank_transfer' WHERE payment_method = 'cheque';
UPDATE public.payment_records SET method = 'bank_transfer' WHERE method = 'cheque';

ALTER TABLE public.purchase_details DROP CONSTRAINT IF EXISTS purchase_details_payment_method_check;
ALTER TABLE public.purchase_details
  ADD CONSTRAINT purchase_details_payment_method_check
  CHECK (payment_method IN ('cash', 'financing', 'down_payment', 'bank_transfer', 'paymongo'));

ALTER TABLE public.payment_records DROP CONSTRAINT IF EXISTS payment_records_method_check;
ALTER TABLE public.payment_records
  ADD CONSTRAINT payment_records_method_check
  CHECK (method IN ('cash', 'financing', 'bank_transfer', 'paymongo'));

ALTER TABLE public.purchase_details DROP CONSTRAINT IF EXISTS purchase_details_requested_term_months_check;
ALTER TABLE public.purchase_details
  ADD CONSTRAINT purchase_details_requested_term_months_check
  CHECK (requested_term_months IN (6, 12, 24, 36, 60));
