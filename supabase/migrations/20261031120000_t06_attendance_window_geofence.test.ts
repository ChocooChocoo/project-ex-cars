import { describe, expect, it } from "vitest";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "supabase/migrations");
const baseline = readFileSync(resolve(root, "20261029130000_t04_head_security_attendance_exemption.sql"), "utf8");
const path = resolve(root, "20261031120000_t06_attendance_window_geofence.sql");
const migration = existsSync(path) ? readFileSync(path, "utf8") : "";
const publicPattern = /CREATE OR REPLACE FUNCTION public\.(\w+)\([\s\S]*?\$\$;/g;
const privatePattern = /CREATE OR REPLACE FUNCTION private\.(\w+)\([\s\S]*?\$\$;/g;
const baselinePublic = new Map([...baseline.matchAll(publicPattern)].map((match) => [match[1], match[0]]));
const updatedPublic = new Map([...migration.matchAll(publicPattern)].map((match) => [match[1], match[0]]));
const updatedPrivate = new Map([...migration.matchAll(privatePattern)].map((match) => [match[1], match[0]]));

function replaceOnce(source: string | undefined, search: string, replacement: string) {
  expect(source).toBeDefined();
  expect(source?.split(search)).toHaveLength(2);
  return source?.replace(search, replacement) ?? "";
}

describe("Clock-in window and GCE geofence migration", () => {
  it("changes get_my_attendance_state only by adding the clock-in window reason", () => {
    const expected = replaceOnce(
      replaceOnce(
        replaceOnce(
          baselinePublic.get("get_my_attendance_state"),
          "  v_blocked_reason TEXT;\nBEGIN\n",
          "  v_blocked_reason TEXT;\n  v_scheduled_start TIMESTAMPTZ;\n  v_scheduled_end TIMESTAMPTZ;\n  v_window_reason TEXT;\nBEGIN\n",
        ),
        "  WHERE ews.employee_id = v_actor;\n\n  SELECT * INTO v_attendance\n",
        "  WHERE ews.employee_id = v_actor;\n\n  v_scheduled_start := ((v_local_date + v_schedule.start_time) AT TIME ZONE v_schedule.timezone);\n  v_scheduled_end := ((v_local_date + v_schedule.end_time) AT TIME ZONE v_schedule.timezone);\n  v_window_reason := private.clock_in_window_reason(v_now, v_scheduled_start, v_scheduled_end);\n\n  SELECT * INTO v_attendance\n",
      ),
      "  v_blocked_reason := 'Approved leave applies today.';\n  ELSIF v_open_attendance.id IS NOT NULL THEN\n",
      "  v_blocked_reason := 'Approved leave applies today.';\n  ELSIF v_window_reason IS NOT NULL THEN\n    v_blocked_reason := v_window_reason;\n  ELSIF v_open_attendance.id IS NOT NULL THEN\n",
    );

    expect(updatedPublic.get("get_my_attendance_state")).toBe(expected);
  });

  it("changes clock_in_attendance only by its parameters, window check, geofence check and audit columns", () => {
    const expected = replaceOnce(
      replaceOnce(
        replaceOnce(
          replaceOnce(
            replaceOnce(
              baselinePublic.get("clock_in_attendance"),
              "CREATE OR REPLACE FUNCTION public.clock_in_attendance()\n",
              "CREATE OR REPLACE FUNCTION public.clock_in_attendance(\n  p_lat DOUBLE PRECISION,\n  p_lng DOUBLE PRECISION,\n  p_accuracy DOUBLE PRECISION\n)\n",
            ),
            "  v_grace_deadline TIMESTAMPTZ;\nBEGIN\n",
            "  v_grace_deadline TIMESTAMPTZ;\n  v_window_reason TEXT;\n  v_distance_m DOUBLE PRECISION;\nBEGIN\n",
          ),
          "  v_grace_deadline := v_scheduled_start + pg_catalog.make_interval(mins => v_schedule.grace_minutes);\n\n  INSERT INTO public.attendance_entries (\n",
          "  v_grace_deadline := v_scheduled_start + pg_catalog.make_interval(mins => v_schedule.grace_minutes);\n\n  v_window_reason := private.clock_in_window_reason(v_now, v_scheduled_start, v_scheduled_end);\n  IF v_window_reason IS NOT NULL THEN\n    RAISE EXCEPTION '%', v_window_reason;\n  END IF;\n\n  IF p_accuracy IS NOT NULL AND p_accuracy > 150 THEN\n    RAISE EXCEPTION 'Location is too imprecise. Try near a window.';\n  END IF;\n\n  v_distance_m := private.gce_distance_m(p_lat, p_lng);\n  IF v_distance_m IS NULL OR v_distance_m > 100 THEN\n    RAISE EXCEPTION 'You must be at the GCE building to clock in.';\n  END IF;\n\n  INSERT INTO public.attendance_entries (\n",
        ),
        "    scheduled_end_at, applied_grace_minutes, schedule_timezone, late_minutes\n  ) VALUES (\n",
        "    scheduled_end_at, applied_grace_minutes, schedule_timezone, late_minutes,\n    clock_in_lat, clock_in_lng, clock_in_distance_m\n  ) VALUES (\n",
      ),
      "    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_now - v_grace_deadline)) / 60)::INTEGER)\n  )\n",
      "    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_now - v_grace_deadline)) / 60)::INTEGER),\n    p_lat, p_lng, v_distance_m\n  )\n",
    );

    expect(updatedPublic.get("clock_in_attendance")).toBe(expected);
  });

  it("replaces only the two attendance functions it owns", () => {
    expect([...updatedPublic.keys()].sort()).toEqual(["clock_in_attendance", "get_my_attendance_state"]);
    for (const untouched of ["clock_out_attendance", "review_attendance", "save_staff_record", "set_account_state"]) {
      expect(updatedPublic.has(untouched)).toBe(false);
    }
  });

  it("adds the distance and window helpers as private functions", () => {
    expect([...updatedPrivate.keys()]).toEqual(["gce_distance_m", "clock_in_window_reason"]);
    expect(updatedPrivate.get("gce_distance_m")).toContain(
      "CREATE OR REPLACE FUNCTION private.gce_distance_m(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)\nRETURNS DOUBLE PRECISION\nLANGUAGE sql\nIMMUTABLE\nSET search_path = ''",
    );
    const distance = updatedPrivate.get("gce_distance_m") ?? "";
    expect(distance).toContain("6371000");
    expect(distance).toContain("14.3274076");
    expect(distance).toContain("120.9535899");
    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTION private.gce_distance_m(DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;",
    );
    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTION private.clock_in_window_reason(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ)\n  FROM PUBLIC, anon, authenticated;",
    );
  });

  it("formats the window messages from the schedule start minus 30 minutes and the end", () => {
    const window = updatedPrivate.get("clock_in_window_reason") ?? "";
    expect(window).toContain("pg_catalog.make_interval(mins => 30)");
    expect(window).toContain("'Clock In opens at '");
    expect(window).toContain("'Clock In closed at '");
    expect(window).toContain("'FMHH12:MI AM'");
    expect(window).toContain("AT TIME ZONE 'Asia/Manila'");
    expect(window).toContain("WHEN p_now > p_scheduled_end THEN");
  });

  it("records the clock-in location for audit and re-grants the new signature", () => {
    for (const column of ["clock_in_lat", "clock_in_lng", "clock_in_distance_m"]) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS ${column} DOUBLE PRECISION`);
    }
    expect(migration).toContain("DROP FUNCTION public.clock_in_attendance();");
    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTION public.clock_in_attendance(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)\n  FROM PUBLIC, anon;",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.clock_in_attendance(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)\n  TO authenticated;",
    );
    expect(migration).toContain(
      "-- ponytail: browser GPS can be spoofed. Upgrade to a device or Wi-Fi check if abuse shows up.",
    );
  });
});
