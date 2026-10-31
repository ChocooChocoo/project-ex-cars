-- T06: an overtime request is one date plus the approved hours. The end date and the free-text reason
-- no longer apply to overtime.

ALTER TABLE public.employee_requests
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(4,2);

-- NOT VALID keeps legacy overtime rows (end_date set, no hours) valid; compute.ts still pays those
-- uncapped. Enforced on every new row and on updates.
ALTER TABLE public.employee_requests
  ADD CONSTRAINT chk_employee_request_overtime_hours
    CHECK (
      request_kind <> 'overtime'
      OR (
        overtime_hours IS NOT NULL
        AND overtime_hours >= 0.5
        AND overtime_hours <= 12
        AND end_date IS NULL
      )
    ) NOT VALID;
