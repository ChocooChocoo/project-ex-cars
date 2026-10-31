-- Phase 3 (batch 2): Clock In opens 30 minutes before the schedule start, closes at the
-- schedule end, and requires the browser to be within 100 m of the GCE building.
-- Historical attendance rows keep their existing values.
ALTER TABLE public.attendance_entries
  ADD COLUMN IF NOT EXISTS clock_in_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS clock_in_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS clock_in_distance_m DOUBLE PRECISION;

-- ponytail: browser GPS can be spoofed. Upgrade to a device or Wi-Fi check if abuse shows up.
CREATE OR REPLACE FUNCTION private.gce_distance_m(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 6371000 * 2 * pg_catalog.asin(pg_catalog.sqrt(
    pg_catalog.power(pg_catalog.sin(pg_catalog.radians(p_lat - 14.3274076) / 2), 2)
    + pg_catalog.cos(pg_catalog.radians(14.3274076))
      * pg_catalog.cos(pg_catalog.radians(p_lat))
      * pg_catalog.power(pg_catalog.sin(pg_catalog.radians(p_lng - 120.9535899) / 2), 2)
  ));
$$;

REVOKE EXECUTE ON FUNCTION private.gce_distance_m(DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.clock_in_window_reason(
  p_now TIMESTAMPTZ,
  p_scheduled_start TIMESTAMPTZ,
  p_scheduled_end TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_now < p_scheduled_start - pg_catalog.make_interval(mins => 30) THEN
      'Clock In opens at '
        || pg_catalog.to_char(
          (p_scheduled_start - pg_catalog.make_interval(mins => 30)) AT TIME ZONE 'Asia/Manila',
          'FMHH12:MI AM'
        )
        || '.'
    WHEN p_now > p_scheduled_end THEN
      'Clock In closed at '
        || pg_catalog.to_char(p_scheduled_end AT TIME ZONE 'Asia/Manila', 'FMHH12:MI AM')
        || '.'
    ELSE NULL
  END;
$$;

REVOKE EXECUTE ON FUNCTION private.clock_in_window_reason(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

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
  v_scheduled_start TIMESTAMPTZ;
  v_scheduled_end TIMESTAMPTZ;
  v_window_reason TEXT;
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

  v_scheduled_start := ((v_local_date + v_schedule.start_time) AT TIME ZONE v_schedule.timezone);
  v_scheduled_end := ((v_local_date + v_schedule.end_time) AT TIME ZONE v_schedule.timezone);
  v_window_reason := private.clock_in_window_reason(v_now, v_scheduled_start, v_scheduled_end);

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
  ELSIF v_window_reason IS NOT NULL THEN
    v_blocked_reason := v_window_reason;
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

DROP FUNCTION public.clock_in_attendance();

CREATE OR REPLACE FUNCTION public.clock_in_attendance(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION
)
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
  v_window_reason TEXT;
  v_distance_m DOUBLE PRECISION;
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

  v_window_reason := private.clock_in_window_reason(v_now, v_scheduled_start, v_scheduled_end);
  IF v_window_reason IS NOT NULL THEN
    RAISE EXCEPTION '%', v_window_reason;
  END IF;

  IF p_accuracy IS NOT NULL AND p_accuracy > 150 THEN
    RAISE EXCEPTION 'Location is too imprecise. Try near a window.';
  END IF;

  v_distance_m := private.gce_distance_m(p_lat, p_lng);
  IF v_distance_m IS NULL OR v_distance_m > 100 THEN
    RAISE EXCEPTION 'You must be at the GCE building to clock in.';
  END IF;

  INSERT INTO public.attendance_entries (
    employee_id, attendance_date, time_in, status, scheduled_start_at,
    scheduled_end_at, applied_grace_minutes, schedule_timezone, late_minutes,
    clock_in_lat, clock_in_lng, clock_in_distance_m
  ) VALUES (
    v_actor, v_local_date, v_now,
    private.attendance_status_at(v_now, v_scheduled_start, v_schedule.grace_minutes),
    v_scheduled_start, v_scheduled_end, v_schedule.grace_minutes,
    v_schedule.timezone,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_now - v_grace_deadline)) / 60)::INTEGER),
    p_lat, p_lng, v_distance_m
  )
  RETURNING * INTO v_entry;

  RETURN v_entry;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Already clocked in.';

END;
$$;

REVOKE EXECUTE ON FUNCTION public.clock_in_attendance(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clock_in_attendance(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  TO authenticated;
