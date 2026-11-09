-- T05: replace schedules only for active employees in the six client-specified roles.
DO $$
DECLARE
  v_actor UUID;
BEGIN
  SELECT ur.account_id INTO v_actor
  FROM private.user_roles AS ur
  JOIN public.profiles AS p ON p.id = ur.account_id
  WHERE ur.active = true AND p.account_state = 'active'
    AND ur.role IN ('account_manager', 'ceo')
  ORDER BY (ur.role = 'account_manager') DESC, ur.account_id
  LIMIT 1;

  -- Fresh database: no staff yet, so nothing to backfill (seed-data creates schedules).
  IF v_actor IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.employee_work_schedules (
    employee_id, workdays, start_time, end_time, grace_minutes, timezone, created_by, updated_by
  )
  SELECT ur.account_id, ARRAY[1, 2, 3, 4, 5, 6]::SMALLINT[], hours.start_time, hours.end_time,
    10, 'Asia/Manila', v_actor, v_actor
  FROM private.user_roles AS ur
  JOIN public.profiles AS p ON p.id = ur.account_id
  JOIN (VALUES
    ('head_accountant', TIME '09:00', TIME '18:00'),
    ('sales_manager', TIME '08:00', TIME '17:00'),
    ('account_manager', TIME '08:00', TIME '17:00'),
    ('marketing_specialist', TIME '08:00', TIME '17:00'),
    ('confidential_informant', TIME '07:00', TIME '16:00'),
    ('mechanic', TIME '07:00', TIME '16:00')
  ) AS hours(role, start_time, end_time) ON hours.role = ur.role
  WHERE ur.active = true AND p.account_state = 'active'
  ON CONFLICT (employee_id) DO UPDATE
  SET workdays = EXCLUDED.workdays,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      grace_minutes = EXCLUDED.grace_minutes,
      timezone = EXCLUDED.timezone,
      updated_by = EXCLUDED.updated_by;
END;
$$;
