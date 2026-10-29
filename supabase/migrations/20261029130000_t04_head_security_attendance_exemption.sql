-- Phase 10: Head Security remains staff but is exempt from personal attendance and schedule editing.
-- CREATE OR REPLACE preserves the existing function privileges. Historical records are untouched.
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
      AND ur.role NOT IN ('customer', 'supplier', 'head_security')
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
      AND ur.role NOT IN ('customer', 'supplier', 'head_security')
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
      AND ur.role NOT IN ('customer', 'supplier', 'head_security')
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
        AND target_role.role NOT IN ('customer', 'supplier', 'head_security')
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
