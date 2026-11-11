-- T10 Phase 4: the buyer re-schedules a delivery. Less than 24 hours before the original delivery, the new
-- date, time and address wait here until the Head Accountant verifies the 50% re-scheduling fee.

BEGIN;

ALTER TABLE public.purchase_details
  ADD COLUMN IF NOT EXISTS reschedule_pending_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reschedule_pending_location TEXT;

COMMIT;
