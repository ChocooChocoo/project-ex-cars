BEGIN;

ALTER TABLE public.payment_records DROP CONSTRAINT IF EXISTS payment_records_payment_kind_check;
ALTER TABLE public.payment_records ADD CONSTRAINT payment_records_payment_kind_check
  CHECK (payment_kind IN ('full', 'delivery_fee', 'downpayment', 'balance', 'reschedule_fee', 'installment'));
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_payment_records_installment_review
  ON public.payment_records (transaction_id, installment_id, rejected_at);
-- One live submission per installment, including concurrent customer requests.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_live_installment
  ON public.payment_records (transaction_id, installment_id)
  WHERE installment_id IS NOT NULL AND rejected_at IS NULL;

CREATE OR REPLACE FUNCTION public.guard_financing_sold()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.transactions t
    JOIN public.installment_accounts a ON a.purchase_transaction_id = t.id
    JOIN public.installments i ON i.account_id = a.id
    WHERE t.vehicle_id = NEW.id
      AND a.state = 'active'
      AND i.state NOT IN ('paid', 'waived')
  ) THEN
    RAISE check_violation USING MESSAGE = 'Pay or waive every financing installment before marking the car sold.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_financing_sold() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_financing_sold ON public.vehicles;
CREATE TRIGGER guard_financing_sold
  BEFORE UPDATE OF listing_state ON public.vehicles
  FOR EACH ROW WHEN (NEW.listing_state = 'sold' AND OLD.listing_state IS DISTINCT FROM 'sold')
  EXECUTE FUNCTION public.guard_financing_sold();

COMMIT;
