-- 00043: Task 32 — attendance checking owned by Account Manager
-- Narrows the review_attendance RPC reviewer guard from
-- ('ceo', 'account_manager', 'head_accountant') to ('account_manager') so DB-level
-- enforcement matches the UI gating in src/app/(staff)/attendance/page.tsx
-- (ATTENDANCE_CHECKERS = ['account_manager']). CEO and Head Accountant keep
-- read/summary oversight via the attendance entries list, which stays visible to
-- all STAFF_ROLES — only the check (review) action is restricted.

CREATE OR REPLACE FUNCTION public.review_attendance(entry_id UUID, status TEXT, notes TEXT)
RETURNS public.attendance_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_entry public.attendance_entries%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles AS ur
    JOIN public.profiles AS p ON p.id = ur.account_id
    WHERE ur.account_id = v_actor
      AND ur.active = true
      AND p.account_state = 'active'
      AND ur.role IN ('account_manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied: attendance reviewer role required.';
  END IF;
  IF review_attendance.status NOT IN ('present', 'absent', 'late', 'half_day', 'on_leave') THEN
    RAISE EXCEPTION 'Invalid attendance status.';
  END IF;

  SELECT * INTO v_entry FROM public.attendance_entries AS ae WHERE ae.id = review_attendance.entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance entry not found.';
  END IF;
  IF v_entry.checked_by IS NOT NULL THEN
    RAISE EXCEPTION 'Attendance has already been checked.';
  END IF;
  IF v_entry.time_in IS NOT NULL AND v_entry.time_out IS NULL THEN
    RAISE EXCEPTION 'Cannot review attendance while the employee is clocked in.';
  END IF;

  UPDATE public.attendance_entries AS ae
  SET status = review_attendance.status,
      notes = NULLIF(review_attendance.notes, ''),
      checked_by = v_actor,
      checked_at = now()
  WHERE ae.id = v_entry.id
  RETURNING * INTO v_entry;
  RETURN v_entry;
END;
$$;
