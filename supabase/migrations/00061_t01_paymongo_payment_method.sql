-- 00061: T01 buying-flow revision, Phase 5 — payments the buyer sends through the PayMongo link
-- The buyer pays on a PayMongo payment link; the row is recorded unverified with method 'paymongo' and
-- the Head Accountant verifies it against the PayMongo receipt.

DO $$ BEGIN
  ALTER TABLE public.payment_records DROP CONSTRAINT IF EXISTS payment_records_method_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.payment_records
  ADD CONSTRAINT payment_records_method_check
  CHECK (method IN ('cash', 'financing', 'cheque', 'bank_transfer', 'paymongo'));
