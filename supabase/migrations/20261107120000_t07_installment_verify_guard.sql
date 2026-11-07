BEGIN;

-- T07 CR1: the two-step rule is a database rule, not only an application rule. A PayMongo
-- installment cannot be marked verified before the Sales Manager approved it.
ALTER TABLE public.payment_records
  DROP CONSTRAINT IF EXISTS payment_records_installment_approval_check;
ALTER TABLE public.payment_records
  ADD CONSTRAINT payment_records_installment_approval_check
  CHECK (
    verified_by IS NULL
    OR approved_at IS NOT NULL
    OR payment_kind <> 'installment'
    OR method <> 'paymongo'
  );

-- The approval queue reads by transaction, not by approved_at; the index added with the columns is unused.
DROP INDEX IF EXISTS public.idx_payment_records_installment_approval;

COMMIT;
