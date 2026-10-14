-- 00062: T01 buying-flow revision, Phase 7 — PayMongo Checkout
-- Pay opens a PayMongo Checkout Session for the exact amounts due. Each row remembers its session; the
-- PayMongo webhook fills in the payment id and the paid time when the buyer has paid.

ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS paymongo_checkout_id text,
  ADD COLUMN IF NOT EXISTS paymongo_payment_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS payment_records_paymongo_checkout_id_idx
  ON public.payment_records (paymongo_checkout_id)
  WHERE paymongo_checkout_id IS NOT NULL;
