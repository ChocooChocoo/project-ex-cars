-- 00050: T01 Phase 2 — Buying Scenario 1, Cash Purchase: Onsite Visit (GCE Process Flows §2)
-- Q0a answered: the Sales Manager approves buyer requests (the CEO keeps an override in the app).
-- - viewing_arrangements.vehicle_id: every visit slot belongs to one car, filled by trigger so a
--   client can never point a booking at another car.
-- - One live booking per car and time: a unique index over pending/confirmed arrangements locks the
--   slot from booking, even before the Sales Manager reviews it.
-- - list_taken_visit_slots(): lets a buyer see which times are taken without seeing whose they are.

-- ============================================================
-- 1. vehicle_id on arrangements, backfilled and kept by trigger
-- ============================================================
ALTER TABLE public.viewing_arrangements
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE;

UPDATE public.viewing_arrangements AS arrangement
SET vehicle_id = COALESCE(
  (SELECT transactions.vehicle_id FROM public.transactions WHERE transactions.id = arrangement.purchase_transaction_id),
  (SELECT inquiries.vehicle_id FROM public.inquiries WHERE inquiries.id = arrangement.inquiry_id)
)
WHERE arrangement.vehicle_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_arrangement_vehicle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Always derived, never trusted from the client.
  NEW.vehicle_id := COALESCE(
    (SELECT transactions.vehicle_id FROM public.transactions WHERE transactions.id = NEW.purchase_transaction_id),
    (SELECT inquiries.vehicle_id FROM public.inquiries WHERE inquiries.id = NEW.inquiry_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS viewing_arrangements_set_vehicle ON public.viewing_arrangements;
CREATE TRIGGER viewing_arrangements_set_vehicle
  BEFORE INSERT OR UPDATE OF purchase_transaction_id, inquiry_id, vehicle_id ON public.viewing_arrangements
  FOR EACH ROW EXECUTE FUNCTION public.set_arrangement_vehicle();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.viewing_arrangements WHERE vehicle_id IS NULL) THEN
    ALTER TABLE public.viewing_arrangements ALTER COLUMN vehicle_id SET NOT NULL;
  END IF;
END $$;

-- ============================================================
-- 2. Slot lock
-- ============================================================
-- Existing data may already hold two live bookings for the same car and time. Keep the earliest
-- booking and cancel the later ones, or the lock index cannot be created.
UPDATE public.viewing_arrangements AS later
SET confirmation_state = 'cancelled'
WHERE later.confirmation_state IN ('pending', 'confirmed')
  AND EXISTS (
    SELECT 1 FROM public.viewing_arrangements AS earlier
    WHERE earlier.vehicle_id = later.vehicle_id
      AND earlier.schedule = later.schedule
      AND earlier.confirmation_state IN ('pending', 'confirmed')
      AND (earlier.created_at, earlier.id) < (later.created_at, later.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_viewing_arrangements_slot_lock
  ON public.viewing_arrangements(vehicle_id, schedule)
  WHERE confirmation_state IN ('pending', 'confirmed');

-- ============================================================
-- 3. Taken slots for a car, without who booked them
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_taken_visit_slots(p_vehicle_id UUID)
RETURNS TABLE (schedule TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT arrangement.schedule
  FROM public.viewing_arrangements AS arrangement
  WHERE arrangement.vehicle_id = p_vehicle_id
    AND arrangement.confirmation_state IN ('pending', 'confirmed')
    AND arrangement.schedule >= now()
    AND auth.uid() IS NOT NULL
  ORDER BY arrangement.schedule;
$$;

REVOKE ALL ON FUNCTION public.list_taken_visit_slots(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_taken_visit_slots(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_taken_visit_slots(UUID) TO authenticated;
