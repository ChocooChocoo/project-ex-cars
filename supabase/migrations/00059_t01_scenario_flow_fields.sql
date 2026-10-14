-- 00059: T01 buying-flow revision, Phase 4 — fields for the reordered scenario flows
-- - payment_terms: the monthly payment and the missed payment policy the Sales Manager states with every
--   financing offer, and the delivery fee of a financed delivery (approved with the terms).
-- - purchase_details: the payment term the buyer asks for at request, and when the buyer agreed to the
--   delivery terms notice.
-- - inquiries: a chat thread tied to a financing request, like the sell negotiation thread (00049).

ALTER TABLE public.payment_terms
  ADD COLUMN IF NOT EXISTS monthly_payment NUMERIC(12,2) CHECK (monthly_payment >= 0),
  ADD COLUMN IF NOT EXISTS missed_payment_policy TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) CHECK (delivery_fee >= 0);

ALTER TABLE public.purchase_details
  ADD COLUMN IF NOT EXISTS requested_term_months INTEGER CHECK (requested_term_months IN (12, 24, 36, 60)),
  ADD COLUMN IF NOT EXISTS delivery_terms_agreed_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_intention_kind_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_intention_kind_check
  CHECK (intention_kind IN ('inquiry', 'buy_now', 'sell_negotiation', 'buy_financing'));

-- Both transaction threads carry their transaction; ordinary inquiries never do.
DO $$ BEGIN
  ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_sell_negotiation_transaction_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_sell_negotiation_transaction_check
  CHECK ((intention_kind IN ('sell_negotiation', 'buy_financing')) = (transaction_id IS NOT NULL));
