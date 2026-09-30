-- 00051: T01 Phase 3 — Buyer queue + Cash Purchase: Meet Halfway (GCE Process Flows §3)
-- - transactions.queue_state: one Active request per car, the rest On Hold. The Sales Manager
--   promotes the next one by hand; nothing auto-promotes. Ending a request always leaves the queue.
-- - The 5-hour cancellation cut-off is enforced here too, so a customer cannot cancel a meet-up
--   or delivery inside the window by writing to the API directly.
-- - purchase_details.condition_acknowledged_at: the buyer's condition acknowledgment (§3 step 3).
-- - field_cases.case_kind += buyer_meetup (§3 step 6).
-- - The 00050 slot lock is narrowed to GCE visits: halfway buyers queue instead of locking a slot.

-- ============================================================
-- 1. Queue
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS queue_state TEXT CHECK (queue_state IN ('active', 'on_hold'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_one_active_request
  ON public.transactions(vehicle_id)
  WHERE queue_state = 'active';

CREATE OR REPLACE FUNCTION public.guard_transaction_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.current_state IN ('rejected', 'completed', 'cancelled') THEN
    NEW.queue_state := NULL;
  END IF;

  -- §3: a buyer may cancel a scheduled meet-up or delivery only 5 hours or more before it.
  -- Staff actions run with the service role (auth.uid() is null) and are not limited here.
  IF NEW.current_state = 'cancelled'
    AND OLD.current_state IS DISTINCT FROM 'cancelled'
    AND auth.uid() IS NOT NULL
    AND auth.uid() = NEW.customer_id
    AND EXISTS (
      SELECT 1 FROM public.viewing_arrangements AS arrangement
      WHERE arrangement.purchase_transaction_id = NEW.id
        AND arrangement.arrangement_kind IN ('meetup', 'delivery')
        AND arrangement.confirmation_state IN ('pending', 'confirmed')
        AND arrangement.schedule < now() + interval '5 hours'
    )
  THEN
    RAISE EXCEPTION 'Cancellation is only allowed 5 hours or more before the scheduled time.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_guard_end ON public.transactions;
CREATE TRIGGER transactions_guard_end
  BEFORE UPDATE OF current_state, queue_state ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_transaction_end();

-- ============================================================
-- 2. Condition acknowledgment
-- ============================================================
ALTER TABLE public.purchase_details
  ADD COLUMN IF NOT EXISTS condition_acknowledged_at TIMESTAMPTZ;

-- ============================================================
-- 3. Buyer meet-up field cases
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.field_cases DROP CONSTRAINT IF EXISTS field_cases_case_kind_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.field_cases
  ADD CONSTRAINT field_cases_case_kind_check
  CHECK (case_kind IN ('acquisition', 'delivery', 'recovery', 'sourcing', 'buyer_meetup'));

-- ============================================================
-- 4. Slot lock applies to GCE visits only (Appendix C: Onsite)
-- ============================================================
DROP INDEX IF EXISTS public.idx_viewing_arrangements_slot_lock;

CREATE UNIQUE INDEX idx_viewing_arrangements_slot_lock
  ON public.viewing_arrangements(vehicle_id, schedule)
  WHERE confirmation_state IN ('pending', 'confirmed') AND arrangement_kind = 'gce_visit';

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
    AND arrangement.arrangement_kind = 'gce_visit'
    AND arrangement.confirmation_state IN ('pending', 'confirmed')
    AND arrangement.schedule >= now()
    AND auth.uid() IS NOT NULL
  ORDER BY arrangement.schedule;
$$;

REVOKE ALL ON FUNCTION public.list_taken_visit_slots(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_taken_visit_slots(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_taken_visit_slots(UUID) TO authenticated;
