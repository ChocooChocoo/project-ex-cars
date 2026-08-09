-- Task 18: schedule-aware staff attendance and RPC-only write paths.

CREATE TABLE public.employee_work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  workdays SMALLINT[] NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_minutes INTEGER NOT NULL DEFAULT 10,
  timezone TEXT NOT NULL DEFAULT 'Asia/Manila' CHECK (timezone = 'Asia/Manila'),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  updated_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_employee_work_schedule_workdays CHECK (
    cardinality(workdays) BETWEEN 1 AND 7
    AND workdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::SMALLINT[]
  ),
  CONSTRAINT chk_employee_work_schedule_same_day CHECK (
    start_time < end_time
  ),
  CONSTRAINT chk_employee_work_schedule_grace CHECK (grace_minutes BETWEEN 5 AND 10)
);

CREATE TRIGGER employee_work_schedules_updated_at
  BEFORE UPDATE ON public.employee_work_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.employee_work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can read own work schedule" ON public.employee_work_schedules
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT auth.uid()));

CREATE POLICY "Attendance managers can read work schedules" ON public.employee_work_schedules
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM private.user_roles AS ur
    WHERE ur.account_id = (SELECT auth.uid())
      AND ur.active = true
      AND ur.role IN ('ceo', 'account_manager', 'head_accountant')
  ));

REVOKE INSERT, UPDATE, DELETE ON public.employee_work_schedules FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.employee_work_schedules TO authenticated;

ALTER TABLE public.attendance_entries
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied_grace_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS schedule_timezone TEXT,
  ADD COLUMN IF NOT EXISTS late_minutes INTEGER;

ALTER TABLE public.attendance_entries
  ADD CONSTRAINT chk_attendance_applied_grace_minutes
    CHECK (applied_grace_minutes IS NULL OR applied_grace_minutes BETWEEN 5 AND 10),
  ADD CONSTRAINT chk_attendance_late_minutes
    CHECK (late_minutes IS NULL OR late_minutes >= 0),
  ADD CONSTRAINT chk_attendance_schedule_timezone
    CHECK (schedule_timezone IS NULL OR schedule_timezone = 'Asia/Manila');

-- Earlier seed runs could produce an end date before the randomly selected
-- start date. Normalize that legacy data before enforcing the invariant.
UPDATE public.employee_requests
SET end_date = start_date
WHERE end_date IS NOT NULL
  AND end_date < start_date;

ALTER TABLE public.employee_requests
  ADD CONSTRAINT chk_employee_request_date_range
    CHECK (end_date IS NULL OR end_date >= start_date);

CREATE INDEX idx_employee_requests_approved_leave_lookup
  ON public.employee_requests (employee_id, start_date, (COALESCE(end_date, start_date)))
  WHERE request_kind = 'leave' AND status = 'approved';

-- All attendance mutations now flow through the actor-derived RPCs below.
DROP POLICY IF EXISTS "Staff can insert own attendance" ON public.attendance_entries;
DROP POLICY IF EXISTS "Staff can update own attendance before checked" ON public.attendance_entries;
DROP POLICY IF EXISTS "Account Manager and Head Accountant can update attendance for checking" ON public.attendance_entries;
REVOKE INSERT, UPDATE ON public.attendance_entries FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.attendance_status_at(
  p_now TIMESTAMPTZ,
  p_scheduled_start TIMESTAMPTZ,
  p_grace_minutes INTEGER
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_now <= p_scheduled_start + pg_catalog.make_interval(mins => p_grace_minutes) THEN 'present'
    ELSE 'late'
  END;
$$;

REVOKE EXECUTE ON FUNCTION private.attendance_status_at(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;

-- Keep the application date boundary in one immutable helper so all
-- date-sensitive attendance paths use the same Philippine-local calendar.
CREATE OR REPLACE FUNCTION private.philippine_local_date_at(p_at TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (p_at AT TIME ZONE 'Asia/Manila')::DATE;
$$;

REVOKE EXECUTE ON FUNCTION private.philippine_local_date_at(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_attendance_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_local_now TIMESTAMP := v_now AT TIME ZONE 'Asia/Manila';
  v_local_date DATE := private.philippine_local_date_at(v_now);
  v_schedule public.employee_work_schedules%ROWTYPE;
  v_attendance public.attendance_entries%ROWTYPE;
  v_open_attendance public.attendance_entries%ROWTYPE;
  v_blocked_reason TEXT;
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
      AND ur.role NOT IN ('customer', 'supplier')
  ) THEN
    RAISE EXCEPTION 'Permission denied: active staff role required.';
  END IF;

  SELECT * INTO v_schedule
  FROM public.employee_work_schedules AS ews
  WHERE ews.employee_id = v_actor;

  SELECT * INTO v_attendance
  FROM public.attendance_entries AS ae
  WHERE ae.employee_id = v_actor
    AND ae.attendance_date = v_local_date
  ORDER BY ae.created_at DESC
  LIMIT 1;

  SELECT * INTO v_open_attendance
  FROM public.attendance_entries AS ae
  WHERE ae.employee_id = v_actor
    AND ae.time_in IS NOT NULL
    AND ae.time_out IS NULL
  ORDER BY ae.time_in DESC, ae.created_at DESC
  LIMIT 1;

  -- The state DTO exposes the row the clock-out action will close.  A stale
  -- open row must win over a closed current-day row so clients do not hide
  -- the available clock-out action behind a UTC/date-derived lookup.
  IF v_open_attendance.id IS NOT NULL THEN
    v_attendance := v_open_attendance;
  END IF;

  IF v_schedule.id IS NULL THEN
    v_blocked_reason := 'No work schedule is assigned.';
  ELSIF NOT (EXTRACT(ISODOW FROM v_local_now)::SMALLINT = ANY(v_schedule.workdays)) THEN
    v_blocked_reason := 'Today is not a scheduled workday.';
  ELSIF EXISTS (
    SELECT 1 FROM public.employee_requests AS er
    WHERE er.employee_id = v_actor
      AND er.request_kind = 'leave'
      AND er.status = 'approved'
      AND er.start_date <= v_local_date
      AND COALESCE(er.end_date, er.start_date) >= v_local_date
  ) THEN
  v_blocked_reason := 'Approved leave applies today.';
  ELSIF v_open_attendance.id IS NOT NULL THEN
    v_blocked_reason := CASE
      WHEN v_open_attendance.checked_by IS NOT NULL THEN 'Attendance has already been checked.'
      ELSE 'Already clocked in.'
    END;
  ELSIF v_attendance.id IS NOT NULL THEN
    v_blocked_reason := CASE
      WHEN v_attendance.checked_by IS NOT NULL THEN 'Attendance has already been checked.'
      ELSE 'Attendance already recorded for today.'
    END;
  END IF;

  RETURN jsonb_build_object(
    'now', v_now,
    'local_date', v_local_date,
    'attendance', CASE WHEN v_attendance.id IS NULL THEN NULL ELSE to_jsonb(v_attendance) END,
    'schedule', CASE WHEN v_schedule.id IS NULL THEN NULL ELSE to_jsonb(v_schedule) END,
    'clock_in_allowed', v_attendance.id IS NULL AND v_open_attendance.id IS NULL AND v_blocked_reason IS NULL,
    'clock_in_blocked_reason', v_blocked_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clock_in_attendance()
RETURNS public.attendance_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_local_now TIMESTAMP := v_now AT TIME ZONE 'Asia/Manila';
  v_local_date DATE := private.philippine_local_date_at(v_now);
  v_schedule public.employee_work_schedules%ROWTYPE;
  v_existing public.attendance_entries%ROWTYPE;
  v_open_attendance public.attendance_entries%ROWTYPE;
  v_entry public.attendance_entries%ROWTYPE;
  v_scheduled_start TIMESTAMPTZ;
  v_scheduled_end TIMESTAMPTZ;
  v_grace_deadline TIMESTAMPTZ;
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
      AND ur.role NOT IN ('customer', 'supplier')
  ) THEN
    RAISE EXCEPTION 'Permission denied: active staff role required.';
  END IF;

  -- Serialize clock-ins per employee.  A second request waits for the first
  -- transaction, then observes its open row and receives the stable duplicate
  -- error instead of a generic unique-violation error.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::TEXT, 0));

  SELECT * INTO v_open_attendance
  FROM public.attendance_entries AS ae
  WHERE ae.employee_id = v_actor
    AND ae.time_in IS NOT NULL
    AND ae.time_out IS NULL
  ORDER BY ae.time_in DESC, ae.created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF FOUND THEN
    IF v_open_attendance.checked_by IS NOT NULL THEN
      RAISE EXCEPTION 'Attendance has already been checked.';
    END IF;
    RAISE EXCEPTION 'Already clocked in.';
  END IF;

  SELECT * INTO v_schedule
  FROM public.employee_work_schedules AS ews
  WHERE ews.employee_id = v_actor
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No work schedule is assigned.';
  END IF;

  IF NOT (EXTRACT(ISODOW FROM v_local_now)::SMALLINT = ANY(v_schedule.workdays)) THEN
    RAISE EXCEPTION 'Today is not a scheduled workday.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.employee_requests AS er
    WHERE er.employee_id = v_actor
      AND er.request_kind = 'leave'
      AND er.status = 'approved'
      AND er.start_date <= v_local_date
      AND COALESCE(er.end_date, er.start_date) >= v_local_date
  ) THEN
    RAISE EXCEPTION 'Approved leave applies today.';
  END IF;

  SELECT * INTO v_existing
  FROM public.attendance_entries AS ae
  WHERE ae.employee_id = v_actor
    AND ae.attendance_date = v_local_date
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.checked_by IS NOT NULL THEN
      RAISE EXCEPTION 'Attendance has already been checked.';
    END IF;
    IF v_existing.time_in IS NOT NULL THEN
      RAISE EXCEPTION 'Already clocked in.';
    END IF;
    RAISE EXCEPTION 'Attendance already recorded for today.';
  END IF;

  v_scheduled_start := ((v_local_date + v_schedule.start_time) AT TIME ZONE v_schedule.timezone);
  v_scheduled_end := ((v_local_date + v_schedule.end_time) AT TIME ZONE v_schedule.timezone);
  v_grace_deadline := v_scheduled_start + pg_catalog.make_interval(mins => v_schedule.grace_minutes);

  INSERT INTO public.attendance_entries (
    employee_id, attendance_date, time_in, status, scheduled_start_at,
    scheduled_end_at, applied_grace_minutes, schedule_timezone, late_minutes
  ) VALUES (
    v_actor, v_local_date, v_now,
    private.attendance_status_at(v_now, v_scheduled_start, v_schedule.grace_minutes),
    v_scheduled_start, v_scheduled_end, v_schedule.grace_minutes,
    v_schedule.timezone,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_now - v_grace_deadline)) / 60)::INTEGER)
  )
  RETURNING * INTO v_entry;

  RETURN v_entry;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Already clocked in.';

END;
$$;

CREATE OR REPLACE FUNCTION public.clock_out_attendance()
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
      AND ur.role NOT IN ('customer', 'supplier')
  ) THEN
    RAISE EXCEPTION 'Permission denied: active staff role required.';
  END IF;

  SELECT * INTO v_entry
  FROM public.attendance_entries AS ae
  WHERE ae.employee_id = v_actor
    AND ae.time_in IS NOT NULL
    AND ae.time_out IS NULL
  ORDER BY ae.time_in DESC, ae.created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No open attendance entry.';
  END IF;
  IF v_entry.checked_by IS NOT NULL THEN
    RAISE EXCEPTION 'Attendance has already been checked.';
  END IF;

  UPDATE public.attendance_entries AS ae
  SET time_out = now()
  WHERE ae.id = v_entry.id
  RETURNING * INTO v_entry;
  RETURN v_entry;
END;
$$;

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
      AND ur.role IN ('ceo', 'account_manager', 'head_accountant')
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

CREATE OR REPLACE FUNCTION public.save_staff_record(
  account_id UUID,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  workdays SMALLINT[],
  start_time TIME,
  end_time TIME,
  grace_minutes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_schedule public.employee_work_schedules%ROWTYPE;
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
      AND ur.role IN ('ceo', 'account_manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied: staff manager role required.';
  END IF;
  IF NULLIF(BTRIM(save_staff_record.full_name), '') IS NULL THEN
    RAISE EXCEPTION 'Full name is required.';
  END IF;

  UPDATE public.profiles AS p
  SET full_name = save_staff_record.full_name,
      phone = NULLIF(save_staff_record.phone, ''),
      address = NULLIF(save_staff_record.address, '')
  WHERE p.id = save_staff_record.account_id
  RETURNING * INTO v_profile;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  IF save_staff_record.workdays IS NOT NULL
     OR save_staff_record.start_time IS NOT NULL
     OR save_staff_record.end_time IS NOT NULL
     OR save_staff_record.grace_minutes IS NOT NULL THEN
    IF save_staff_record.workdays IS NULL
       OR save_staff_record.start_time IS NULL
       OR save_staff_record.end_time IS NULL
       OR save_staff_record.grace_minutes IS NULL THEN
      RAISE EXCEPTION 'A complete work schedule is required.';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles AS target_profile
      JOIN private.user_roles AS target_role ON target_role.account_id = target_profile.id
      WHERE target_profile.id = save_staff_record.account_id
        AND target_role.active = true
        AND target_role.role NOT IN ('customer', 'supplier')
    ) THEN
      RAISE EXCEPTION 'Work schedules require an active staff target.';
    END IF;

    INSERT INTO public.employee_work_schedules (
      employee_id, workdays, start_time, end_time, grace_minutes, timezone, created_by, updated_by
    ) VALUES (
      save_staff_record.account_id, save_staff_record.workdays, save_staff_record.start_time,
      save_staff_record.end_time, save_staff_record.grace_minutes, 'Asia/Manila', v_actor, v_actor
    )
    ON CONFLICT (employee_id) DO UPDATE
    SET workdays = EXCLUDED.workdays,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        grace_minutes = EXCLUDED.grace_minutes,
        timezone = EXCLUDED.timezone,
        updated_by = v_actor
    RETURNING * INTO v_schedule;
  END IF;

  INSERT INTO public.audit_events (actor_id, action, record_kind, record_id, summary)
  VALUES (
    v_actor,
    'staff_record_saved',
    'profiles',
    save_staff_record.account_id,
    'Staff record ' || save_staff_record.account_id || ' saved'
  );

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'schedule', CASE WHEN v_schedule.id IS NULL THEN NULL::JSONB ELSE to_jsonb(v_schedule) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_account_state(account_id UUID, state TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
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
      AND ur.role IN ('ceo', 'account_manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied: staff manager role required.';
  END IF;
  IF set_account_state.state NOT IN ('invited', 'active', 'suspended', 'archived') THEN
    RAISE EXCEPTION 'Invalid account state.';
  END IF;

  UPDATE public.profiles AS p
  SET account_state = set_account_state.state,
      activated_at = CASE
        WHEN set_account_state.state = 'active' AND p.activated_at IS NULL THEN now()
        ELSE p.activated_at
      END
  WHERE p.id = set_account_state.account_id
  RETURNING * INTO v_profile;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  INSERT INTO public.audit_events (actor_id, action, record_kind, record_id, summary)
  VALUES (
    v_actor,
    'account_state_' || set_account_state.state,
    'profiles',
    set_account_state.account_id,
    'Account ' || set_account_state.account_id || ' state changed to ' || set_account_state.state
  );

  RETURN to_jsonb(v_profile);
END;
$$;

-- ALTER PUBLICATION has no IF NOT EXISTS form.  Check catalog state so a reset
-- and repeated migration application are both safe.
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['attendance_entries', 'employee_work_schedules', 'employee_requests'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables AS ppt
      WHERE ppt.pubname = 'supabase_realtime'
        AND ppt.schemaname = 'public'
        AND ppt.tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_attendance_state() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clock_in_attendance() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clock_out_attendance() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_attendance(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_staff_record(UUID, TEXT, TEXT, TEXT, SMALLINT[], TIME, TIME, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_account_state(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_attendance_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_in_attendance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_out_attendance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_attendance(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_staff_record(UUID, TEXT, TEXT, TEXT, SMALLINT[], TIME, TIME, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_account_state(UUID, TEXT) TO authenticated;
