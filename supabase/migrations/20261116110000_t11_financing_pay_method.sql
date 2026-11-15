-- T11 Phase 2: a financed purchase can be settled two ways. The buyer picks whether the down payment and the
-- monthly installments are paid in cash at the office or collected through PayMongo checkout. The Financier and
-- the Head Accountant read the choice off purchase_details.
-- payment_method stays 'financing' — the arrangement is still a financing one; financing_pay_method only says
-- how the money moves.

BEGIN;

ALTER TABLE public.purchase_details
  ADD COLUMN IF NOT EXISTS financing_pay_method TEXT DEFAULT 'paymongo'
    CHECK (financing_pay_method IN ('cash', 'paymongo'));

COMMIT;
