BEGIN;

SELECT plan(62);

-- These identities are inserted while the test runs as postgres.  The migration
-- must never give their browser role a direct attendance write path.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task18-employee@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task18-manager@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task18-customer@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task18-supplier@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

UPDATE private.user_roles SET role = 'mechanic', active = true WHERE account_id = '11111111-1111-1111-1111-111111111111';
UPDATE private.user_roles SET role = 'account_manager', active = true WHERE account_id = '22222222-2222-2222-2222-222222222222';
UPDATE private.user_roles SET role = 'customer', active = true WHERE account_id = '33333333-3333-3333-3333-333333333333';
UPDATE private.user_roles SET role = 'supplier', active = true WHERE account_id = '44444444-4444-4444-4444-444444444444';

SELECT has_table('public', 'employee_work_schedules', 'employee schedules are stored in public');
SELECT has_column('public', 'attendance_entries', 'scheduled_start_at', 'attendance snapshots scheduled start');
SELECT has_column('public', 'attendance_entries', 'late_minutes', 'attendance snapshots late minutes');
SELECT has_column('public', 'attendance_entries', 'clock_in_lat', 'attendance snapshots the clock-in latitude');
SELECT has_column('public', 'attendance_entries', 'clock_in_lng', 'attendance snapshots the clock-in longitude');
SELECT has_column('public', 'attendance_entries', 'clock_in_distance_m', 'attendance snapshots the clock-in distance');
SELECT has_index('public', 'employee_requests', 'idx_employee_requests_approved_leave_lookup', 'approved leave lookup is indexed');
SELECT has_function('public', 'get_my_attendance_state', ARRAY[]::text[], 'attendance state RPC exists');
SELECT has_function('public', 'clock_in_attendance', ARRAY['double precision', 'double precision', 'double precision'], 'clock-in RPC exists');
SELECT has_function('private', 'gce_distance_m', ARRAY['double precision', 'double precision'], 'GCE distance helper exists');
SELECT has_function('private', 'clock_in_window_reason', ARRAY['timestamp with time zone', 'timestamp with time zone', 'timestamp with time zone'], 'clock-in window helper exists');
SELECT has_function('public', 'clock_out_attendance', ARRAY[]::text[], 'clock-out RPC exists');
SELECT has_function('public', 'review_attendance', ARRAY['uuid', 'text', 'text'], 'review RPC exists');
SELECT has_function('public', 'save_staff_record', ARRAY['uuid', 'text', 'text', 'text', 'smallint[]', 'time without time zone', 'time without time zone', 'integer'], 'staff record and schedule RPC exists');
SELECT has_function('public', 'set_account_state', ARRAY['uuid', 'text'], 'account state RPC exists');
SELECT ok(has_function_privilege('authenticated', 'public.clock_in_attendance(double precision, double precision, double precision)', 'EXECUTE'), 'authenticated can execute clock-in RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.clock_in_attendance(double precision, double precision, double precision)', 'EXECUTE'), 'anon cannot execute clock-in RPC');
SELECT ok(NOT has_table_privilege('authenticated', 'public.attendance_entries', 'INSERT'), 'authenticated cannot directly insert attendance');
SELECT ok(NOT has_table_privilege('authenticated', 'public.attendance_entries', 'UPDATE'), 'authenticated cannot directly update attendance');
SELECT ok(
  POSITION('pg_advisory_xact_lock' IN pg_get_functiondef('public.clock_in_attendance(double precision, double precision, double precision)'::regprocedure)) > 0,
  'clock-in serializes concurrent requests with an advisory transaction lock'
);
SELECT is(
  private.philippine_local_date_at(TIMESTAMPTZ '2026-08-08 15:59:59+00')::TEXT,
  '2026-08-08',
  'Philippine date remains the prior day before its midnight boundary'
);
SELECT is(
  private.philippine_local_date_at(TIMESTAMPTZ '2026-08-08 16:00:00+00')::TEXT,
  '2026-08-09',
  'Philippine date advances at its midnight boundary'
);

SELECT is(
  private.clock_in_window_reason(
    TIMESTAMPTZ '2026-08-09 06:00:00+08',
    TIMESTAMPTZ '2026-08-09 07:00:00+08',
    TIMESTAMPTZ '2026-08-09 16:00:00+08'
  ),
  'Clock In opens at 6:30 AM.',
  'clock-in before the window opens reports the 6:30 AM opening'
);
SELECT is(
  private.clock_in_window_reason(
    TIMESTAMPTZ '2026-08-09 06:30:00+08',
    TIMESTAMPTZ '2026-08-09 07:00:00+08',
    TIMESTAMPTZ '2026-08-09 16:00:00+08'
  ),
  NULL,
  'clock-in is open at exactly 30 minutes before the schedule start'
);
SELECT is(
  private.clock_in_window_reason(
    TIMESTAMPTZ '2026-08-09 12:00:00+08',
    TIMESTAMPTZ '2026-08-09 07:00:00+08',
    TIMESTAMPTZ '2026-08-09 16:00:00+08'
  ),
  NULL,
  'clock-in is open inside the schedule window'
);
SELECT is(
  private.clock_in_window_reason(
    TIMESTAMPTZ '2026-08-09 16:30:00+08',
    TIMESTAMPTZ '2026-08-09 07:00:00+08',
    TIMESTAMPTZ '2026-08-09 16:00:00+08'
  ),
  'Clock In closed at 4:00 PM.',
  'clock-in after the schedule end reports the 4:00 PM closing'
);

SELECT ok(
  private.gce_distance_m(14.3274076, 120.9535899) < 1,
  'the GCE pin is the distance origin'
);
SELECT ok(
  private.gce_distance_m(14.3276, 120.9536) < 100,
  'a point beside the GCE building is inside the 100 m radius'
);
SELECT ok(
  private.gce_distance_m(14.3364, 120.9536) > 100,
  'a point a kilometre away is outside the 100 m radius'
);

SELECT throws_matching(
  $$INSERT INTO public.employee_work_schedules (employee_id, workdays, start_time, end_time, created_by, updated_by)
    VALUES ('11111111-1111-1111-1111-111111111111', ARRAY[1]::smallint[], '09:00', '09:00', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222')$$,
  '.*chk_employee_work_schedule_same_day.*',
  'schedule end must be after its same-day start'
);
SELECT throws_matching(
  $$INSERT INTO public.employee_work_schedules (employee_id, workdays, start_time, end_time, grace_minutes, created_by, updated_by)
    VALUES ('11111111-1111-1111-1111-111111111111', ARRAY[1]::smallint[], '08:00', '17:00', 4, '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222')$$,
  '.*chk_employee_work_schedule_grace.*',
  'schedule grace is constrained to the approved range'
);
SELECT throws_matching(
  $$INSERT INTO public.employee_requests (employee_id, request_kind, status, start_date, end_date, reason)
    VALUES ('11111111-1111-1111-1111-111111111111', 'leave', 'approved', DATE '2026-08-10', DATE '2026-08-09', 'invalid range')$$,
  '.*chk_employee_request_date_range.*',
  'leave ranges cannot end before they start'
);
SELECT throws_matching(
  $$INSERT INTO public.employee_work_schedules (employee_id, workdays, start_time, end_time, created_by, updated_by)
    VALUES ('11111111-1111-1111-1111-111111111111', ARRAY[8]::smallint[], '08:00', '17:00', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222')$$,
  '.*chk_employee_work_schedule_workdays.*',
  'schedule workdays are restricted to ISO days 1 through 7'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT throws_matching($$SELECT public.clock_in_attendance(14.3274076, 120.9535899, 5)$$, 'No work schedule is assigned\.', 'missing schedule blocks clock-in');
RESET ROLE;

-- A fixed all-day schedule keeps this integration fixture independent of the
-- test runner wall clock and always inside the 30-minute pre-shift window.
-- Exact window and grace boundaries are tested by the pure helpers above.
INSERT INTO public.employee_work_schedules (employee_id, workdays, start_time, end_time, grace_minutes, created_by, updated_by)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  ARRAY[EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Asia/Manila'))::smallint],
  '00:00',
  '24:00', 10,
  '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222'
);

UPDATE public.employee_work_schedules
SET workdays = ARRAY[((EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Asia/Manila'))::INTEGER % 7) + 1)::SMALLINT]
WHERE employee_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT throws_matching($$SELECT public.clock_in_attendance(14.3274076, 120.9535899, 5)$$, 'Today is not a scheduled workday\.', 'off-day blocks clock-in');
RESET ROLE;
UPDATE public.employee_work_schedules
SET workdays = ARRAY[EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Asia/Manila'))::SMALLINT]
WHERE employee_id = '11111111-1111-1111-1111-111111111111';

UPDATE private.user_roles SET active = false WHERE account_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT throws_matching($$SELECT public.clock_in_attendance(14.3274076, 120.9535899, 5)$$, 'Permission denied.*', 'inactive staff role cannot clock in');
RESET ROLE;
UPDATE private.user_roles SET active = true WHERE account_id = '11111111-1111-1111-1111-111111111111';

UPDATE public.profiles SET account_state = 'suspended' WHERE id = '11111111-1111-1111-1111-111111111111';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT throws_matching($$SELECT public.clock_in_attendance(14.3274076, 120.9535899, 5)$$, 'Permission denied.*', 'inactive profile cannot clock in');
RESET ROLE;
UPDATE public.profiles SET account_state = 'active' WHERE id = '11111111-1111-1111-1111-111111111111';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT throws_matching(
  $$SELECT public.clock_in_attendance(14.3274076, 120.9535899, 500)$$,
  'Location is too imprecise\. Try near a window\.',
  'an imprecise browser location blocks clock-in'
);
SELECT throws_matching(
  $$SELECT public.clock_in_attendance(14.3364, 120.9536, 5)$$,
  'You must be at the GCE building to clock in\.',
  'clock-in one kilometre from the GCE building is refused'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

SELECT throws_matching(
  $$INSERT INTO public.attendance_entries (employee_id, attendance_date, time_in)
    VALUES ('11111111-1111-1111-1111-111111111111', CURRENT_DATE, now())$$,
  '.*(row-level security|permission denied).*',
  'employees cannot insert attendance directly'
);
SELECT throws_matching(
  $$UPDATE public.attendance_entries SET notes = 'direct write' WHERE employee_id = '11111111-1111-1111-1111-111111111111'$$,
  '.*(row-level security|permission denied).*',
  'employees cannot update attendance directly'
);
SELECT matches((SELECT (public.clock_in_attendance(14.3274076, 120.9535899, 5)).status), '^(present|late)$', 'clock-in classifies the fixed all-day schedule');
SELECT is(
  (SELECT attendance_date FROM public.attendance_entries WHERE employee_id = auth.uid() ORDER BY time_in DESC LIMIT 1),
  ((now() AT TIME ZONE 'Asia/Manila')::date),
  'clock-in records the Philippine local date'
);
SELECT ok(
  (SELECT clock_in_distance_m < 100 FROM public.attendance_entries WHERE employee_id = auth.uid() ORDER BY time_in DESC LIMIT 1),
  'clock-in stores the measured distance to the GCE building for audit'
);
SELECT throws_matching($$SELECT public.clock_in_attendance(14.3274076, 120.9535899, 5)$$, 'Already clocked in\.', 'duplicate clock-in has a stable error');

RESET ROLE;
SELECT is(
  private.attendance_status_at(TIMESTAMPTZ '2026-08-09 00:10:00+00', TIMESTAMPTZ '2026-08-09 00:00:00+00', 10),
  'present',
  'the exact grace deadline is present'
);
SELECT is(
  private.attendance_status_at(TIMESTAMPTZ '2026-08-09 00:10:01+00', TIMESTAMPTZ '2026-08-09 00:00:00+00', 10),
  'late',
  'one second beyond grace is late'
);

RESET ROLE;
DELETE FROM public.attendance_entries WHERE employee_id = '11111111-1111-1111-1111-111111111111';
INSERT INTO public.employee_requests (employee_id, request_kind, status, start_date, end_date, reason)
VALUES ('11111111-1111-1111-1111-111111111111', 'leave', 'approved', (now() AT TIME ZONE 'Asia/Manila')::date, NULL, 'same-day approved leave');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT throws_matching($$SELECT public.clock_in_attendance(14.3274076, 120.9535899, 5)$$, 'Approved leave.*', 'a null leave end date blocks its inclusive start day');

RESET ROLE;
DELETE FROM public.employee_requests WHERE employee_id = '11111111-1111-1111-1111-111111111111';
INSERT INTO public.employee_requests (employee_id, request_kind, status, start_date, end_date, reason)
VALUES ('11111111-1111-1111-1111-111111111111', 'leave', 'approved', (now() AT TIME ZONE 'Asia/Manila')::date - 1, (now() AT TIME ZONE 'Asia/Manila')::date, 'inclusive approved leave');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT throws_matching($$SELECT public.clock_in_attendance(14.3274076, 120.9535899, 5)$$, 'Approved leave.*', 'the inclusive leave end date blocks clock-in');

RESET ROLE;
DELETE FROM public.employee_requests WHERE employee_id = '11111111-1111-1111-1111-111111111111';
INSERT INTO public.attendance_entries (employee_id, attendance_date, time_in, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', DATE '2020-01-01', now() - INTERVAL '2 hours', 'present'),
  ('11111111-1111-1111-1111-111111111111', DATE '2020-01-02', now() - INTERVAL '1 hour', 'present');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT throws_matching($$SELECT public.clock_in_attendance(14.3274076, 120.9535899, 5)$$, 'Already clocked in\.', 'clock-in blocks a historical open row');
SELECT is(
  public.get_my_attendance_state() ->> 'clock_in_allowed',
  'false',
  'attendance state blocks clock-in when any open row exists'
);
SELECT lives_ok($$SELECT public.clock_out_attendance()$$, 'clock-out closes the latest open row without using a UTC date filter');
SELECT ok((SELECT time_out IS NOT NULL FROM public.attendance_entries WHERE employee_id = auth.uid() AND attendance_date = DATE '2020-01-02'), 'clock-out closes the latest open row');
SELECT ok((SELECT time_out IS NULL FROM public.attendance_entries WHERE employee_id = auth.uid() AND attendance_date = DATE '2020-01-01'), 'older open row remains available after latest-row clock-out');

RESET ROLE;
DELETE FROM public.attendance_entries
WHERE employee_id = '11111111-1111-1111-1111-111111111111'
  AND attendance_date IN (DATE '2020-01-01', DATE '2020-01-02');
INSERT INTO public.attendance_entries (employee_id, attendance_date, time_in, status, checked_by, checked_at)
VALUES ('11111111-1111-1111-1111-111111111111', DATE '2020-01-03', now(), 'present', '22222222-2222-2222-2222-222222222222', now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT throws_matching($$SELECT public.clock_out_attendance()$$, 'Attendance has already been checked\.', 'checked open attendance cannot be clocked out');

RESET ROLE;
INSERT INTO public.attendance_entries (employee_id, attendance_date, time_in, status)
VALUES ('11111111-1111-1111-1111-111111111111', DATE '2020-01-02', now(), 'present');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
SELECT throws_matching(
  $$SELECT public.review_attendance((SELECT id FROM public.attendance_entries WHERE attendance_date = DATE '2020-01-02'), 'present', 'too early')$$,
  'Cannot review attendance while the employee is clocked in\.',
  'reviewing an open attendance row is rejected'
);

SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
SELECT throws_matching($$SELECT public.get_my_attendance_state()$$, 'Permission denied.*', 'customer cannot access staff attendance state');
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
SELECT throws_matching($$SELECT public.clock_in_attendance(14.3274076, 120.9535899, 5)$$, 'Permission denied.*', 'supplier cannot clock in');

RESET ROLE;
UPDATE public.profiles SET account_state = 'suspended' WHERE id = '11111111-1111-1111-1111-111111111111';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT throws_matching($$SELECT public.clock_out_attendance()$$, 'Permission denied.*', 'inactive profile cannot clock out');
RESET ROLE;
UPDATE public.profiles SET account_state = 'active' WHERE id = '11111111-1111-1111-1111-111111111111';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
SELECT lives_ok(
  $$SELECT public.save_staff_record('11111111-1111-1111-1111-111111111111', 'Updated employee', '09170000000', 'Manila', ARRAY[1, 2, 3, 4, 5]::smallint[], '08:00', '17:00', 10)$$,
  'staff manager can atomically save a profile and schedule'
);
SELECT is(
  (SELECT action FROM public.audit_events WHERE record_id = '11111111-1111-1111-1111-111111111111' ORDER BY created_at DESC LIMIT 1),
  'staff_record_saved',
  'successful staff save emits an audit event'
);
SELECT throws_matching(
  $$SELECT public.save_staff_record('33333333-3333-3333-3333-333333333333', 'Customer', NULL, NULL, ARRAY[1, 2, 3, 4, 5]::smallint[], '08:00', '17:00', 10)$$,
  'Work schedules require an active staff target\.',
  'staff save rejects schedules for customer targets'
);

SELECT * FROM finish();
ROLLBACK;
