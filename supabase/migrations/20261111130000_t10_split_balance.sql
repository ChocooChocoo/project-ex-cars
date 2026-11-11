-- T10 Phase 5: PayMongo refuses a single payment of ₱999,999 or more, so a large Bank Transfer balance is paid
-- in parts. Each part is its own payment row numbered by part_no; the once-per-kind rule now applies per part,
-- so two parts can be recorded but the same part never twice.

BEGIN;

ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS part_no SMALLINT NOT NULL DEFAULT 1 CHECK (part_no >= 1);

DROP INDEX IF EXISTS public.idx_payment_records_once_per_kind;
CREATE UNIQUE INDEX idx_payment_records_once_per_kind
  ON public.payment_records (transaction_id, payment_kind, part_no)
  WHERE installment_id IS NULL
    AND rejected_at IS NULL
    AND payment_kind <> 'reschedule_fee';

COMMIT;
