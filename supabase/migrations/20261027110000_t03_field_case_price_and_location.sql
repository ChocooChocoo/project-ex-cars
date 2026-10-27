-- T03 Phase 11.
-- CI1–CI3: the price status the Confidential Informant records at the seller meet-up.
-- D1: the delivery team's last shared position.
-- Timestamped name so it runs after every existing migration on a fresh reset.

ALTER TABLE public.field_cases
  ADD COLUMN IF NOT EXISTS price_status TEXT CHECK (price_status IN ('negotiated', 'displayed_price')),
  ADD COLUMN IF NOT EXISTS updated_price NUMERIC CHECK (updated_price > 0),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION CHECK (last_lat BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION CHECK (last_lng BETWEEN -180 AND 180),
  ADD COLUMN IF NOT EXISTS last_located_at TIMESTAMPTZ;

-- These columns are written only by the server actions recordFieldPrice and updateDeliveryLocation, which run
-- with the service role after checking that the caller is assigned to the case. The existing field-worker
-- UPDATE policy is not limited to assigned cases, so browser sessions are stopped from changing them here.
CREATE OR REPLACE FUNCTION public.guard_field_case_price_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.price_status := NULL;
      NEW.updated_price := NULL;
      NEW.discount_amount := NULL;
      NEW.last_lat := NULL;
      NEW.last_lng := NULL;
      NEW.last_located_at := NULL;
    ELSE
      NEW.price_status := OLD.price_status;
      NEW.updated_price := OLD.updated_price;
      NEW.discount_amount := OLD.discount_amount;
      NEW.last_lat := OLD.last_lat;
      NEW.last_lng := OLD.last_lng;
      NEW.last_located_at := OLD.last_located_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_field_case_price_location ON public.field_cases;
CREATE TRIGGER guard_field_case_price_location
  BEFORE INSERT OR UPDATE ON public.field_cases
  FOR EACH ROW EXECUTE FUNCTION public.guard_field_case_price_location();
