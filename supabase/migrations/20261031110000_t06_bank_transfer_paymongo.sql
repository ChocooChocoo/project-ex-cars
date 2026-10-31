-- T06 Phase 2 (batch 2 feedback, test 4 and 7).
-- Bank Transfer is paid through PayMongo, so PayMongo is no longer a purchase method of its own.
-- - purchase_details.payment_method: old 'paymongo' rows become bank transfers.
-- - purchase_details CHECK: Cash, Financing, legacy down_payment, Bank Transfer. No PayMongo.
-- - payment_records.method keeps 'paymongo': that is the channel a bank transfer was paid on.

UPDATE public.purchase_details SET payment_method = 'bank_transfer' WHERE payment_method = 'paymongo';

ALTER TABLE public.purchase_details DROP CONSTRAINT IF EXISTS purchase_details_payment_method_check;
ALTER TABLE public.purchase_details
  ADD CONSTRAINT purchase_details_payment_method_check
  CHECK (payment_method IN ('cash', 'financing', 'down_payment', 'bank_transfer'));
