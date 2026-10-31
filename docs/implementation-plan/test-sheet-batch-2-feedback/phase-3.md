[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)

**Status:** 🟡 In progress

**Status note (2026-10-31):** Migration, pgTAP cases, server action, client geolocation flow and Vitest coverage are
implemented. Targeted Vitest suites pass and `tsc` reports no errors in the touched files. The migration and pgTAP
scripts were not executed against a database because this environment has no local Supabase stack. Live Playwright
geolocation QA is deferred to the main agent.

# Phase 3: Clock-in window and GCE geofence

**Goal:** Clock In works only from 30 minutes before the schedule start until the end time, and only within 100 m of
the GCE building.

Source: client answer on batch 2 test 13 (Clock in and leave requests):
- "pag di na po nila time bawal sila mag check in kasi nakapag check in po kami kahit 3am na po". In English: staff
  could clock in at 3 AM.
- "yung check in nila dapat po sa mismong location lang po ni GCE building". In English: clock-in must be at the GCE
  building.

The client sent this Maps link: https://maps.app.goo.gl/LFw6xLNQLyj85VDA7. Its pin is 14.3274076, 120.9535899.

Decisions (2026-10-31):
- Clock In opens 30 minutes before the start time and closes at the end time. For a 07:00–16:00 schedule, that is
  06:30–16:00. Late still counts after start + grace.
- Radius is 100 m. If the location is denied or unavailable, clock-in is blocked.

Today, `clock_in_attendance()` (`supabase/migrations/20261029130000_t04_head_security_attendance_exemption.sql:96-211`)
computes `v_scheduled_start` and `v_scheduled_end` but never compares them to now. `get_my_attendance_state()`
(same file, :3-94) repeats the same checks for the UI. No geolocation code exists for attendance.

## Dependencies

- None

## Tasks

- [x] Migration `supabase/migrations/20261031120000_t06_attendance_window_geofence.sql` (+ `.test.ts`):
  - Follow the strict pattern in `20261029130000_t04_head_security_attendance_exemption.test.ts`. Each new function
    body must equal the old one plus only the intended change.
  - `get_my_attendance_state()`: add the window check to `clock_in_blocked_reason`. Messages: "Clock In opens at
    6:30 AM." and "Clock In closed at 4:00 PM.", formatted from `v_scheduled_start - 30 min` and `v_scheduled_end`.
  - `DROP FUNCTION public.clock_in_attendance()`. Create `public.clock_in_attendance(p_lat double precision, p_lng
    double precision, p_accuracy double precision)` with the same window check, then the geofence check.
  - The geofence check uses a new `private.gce_distance_m(lat, lng)`: the haversine distance to 14.3274076,
    120.9535899. Refusal messages:
    - "You must be at the GCE building to clock in." when the distance is over 100 m.
    - "Location is too imprecise. Try near a window." when the accuracy is over 150 m.
  - Re-grant EXECUTE as before.
  - Add `clock_in_lat`, `clock_in_lng` and `clock_in_distance_m` to `attendance_entries` for audit.
  - Add a `ponytail:` comment: browser GPS can be spoofed. Upgrade to a device or Wi-Fi check if abuse shows up.
- [ ] Add cases to the pgTAP file `supabase/tests/task18_staff_attendance_test.sql`:
  - before the window
  - after the end
  - off-site
  - on-site inside the window

  Cases are added and `plan(62)` matches 62 assertion statements, but the SQL was not executed here (no local Supabase
  stack). Marked pending until the main agent runs pgTAP.
- [x] `src/app/(staff)/attendance/actions.ts:68-90`: change to `clockIn(lat, lng, accuracy)`, validated with zod.
  Reuse the `locationSchema` shape from `src/app/(staff)/field-cases/delivery-actions.ts:210-213`.
- [x] `src/app/(staff)/attendance/_components/attendance-client.tsx:290, 559`:
  - On press, call `navigator.geolocation.getCurrentPosition` with high accuracy and a 20 s timeout, then call
    `clockIn`.
  - Show messages for permission denied and for no geolocation support. Follow the pattern in
    `field-cases/[id]/_components/share-location.tsx:38-58`.
- [x] Remove the unused `_buildAttendanceState` (`src/app/(staff)/attendance/page.tsx:290-336`).
- [x] Add a Vitest test for the client that mocks geolocation (pattern: `share-location.test.tsx:23`). Cover success,
  permission denied and an RPC error.

## Done when

- [ ] Before 06:30 and after 16:00 Manila time, Clock In is disabled and shows the window message.

  Implemented in SQL and covered by deterministic pgTAP helper cases that have not been run locally. The client already
  disables Clock In and renders `clock_in_blocked_reason` from the server.
- [x] With location denied, clock-in is refused with a clear message.

  Covered by `attendance-client-clock-in.test.tsx` (passing).
- [ ] Playwright MCP with a geolocation override:
  - at GCE (14.3274, 120.9536), clock-in succeeds
  - at a point 1 km away, clock-in is refused

  Live QA deferred to main agent.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

  Not run: the subagent contract forbids `check:fix`, the full test suite and `build`. Targeted Vitest runs pass.
  `npx tsc --noEmit` fails only on the pre-existing generated `.next/dev/types/validator.ts`; a scoped `tsc` run over
  `src/` reports only an unrelated pre-existing error in `employee-requests-client.test.tsx`.

---

## Live QA (2026-10-31, main agent)

Migration `20261031120000_t06_attendance_window_geofence.sql` was pushed to the hosted project together with the three
other batch 2 migrations (`supabase db push`, 8 migrations applied in filename order).

- `mechanic@gce.local` at 14.3274076, 120.9535899 with 12 m accuracy: Clock In succeeds ("Clocked in.", status Late)
  and the row records `clock_in_lat/lng` plus `clock_in_distance_m = 0`.
- The same account at 14.3374, 120.9536 (about 1.1 km away): refused with "You must be at the GCE building to clock in."
  and the state stays "Not clocked in".
- Clock In is enabled inside the 07:00-16:00 window on the attendance page.
- Still covered only by unit/pgTAP, not live: the before-06:30 and after-16:00 messages (the server clock cannot be
  shifted here), and the permission-denied path (the shared MCP browser already had geolocation granted for the earlier
  account).

---

[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)
