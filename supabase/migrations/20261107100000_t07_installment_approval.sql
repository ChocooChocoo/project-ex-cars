BEGIN;

-- T07 CR1: a PayMongo installment reaches the Sales Manager first, then the Head Accountant. The row
-- records both steps so neither role can skip the other.
ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_payment_records_installment_approval
  ON public.payment_records (transaction_id, installment_id, approved_at);

COMMIT;
