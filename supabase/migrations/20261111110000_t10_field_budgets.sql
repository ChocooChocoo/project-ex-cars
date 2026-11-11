-- T10 Phase 3: a Confidential Informant's field budget. Before a delivery (and, in Phase 9, a Meet Halfway
-- purchase) the Confidential Informant requests estimated expenses from the Head Accountant on the field case,
-- logs each expense with a receipt, and returns what is left; the Head Accountant confirms the return.

BEGIN;

ALTER TABLE public.disbursement_requests
  ADD COLUMN IF NOT EXISTS field_case_id UUID REFERENCES public.field_cases(id),
  ADD COLUMN IF NOT EXISTS returned_cents BIGINT CHECK (returned_cents IS NULL OR returned_cents >= 0),
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_confirmed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS return_confirmed_at TIMESTAMPTZ;

-- One live budget per field case; a rejected request frees the case for a new one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_disbursement_requests_live_field_budget
  ON public.disbursement_requests (field_case_id)
  WHERE field_case_id IS NOT NULL AND status <> 'rejected';

COMMIT;
