import { describe, expect, it } from "vitest";

import { ROLE_WORK_SCHEDULES } from "@/lib/attendance/role-schedules";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(process.cwd(), "supabase/migrations/20261029120000_t05_role_schedules.sql");
const sql = existsSync(path) ? readFileSync(path, "utf8") : "";

describe("T05 role schedule backfill", () => {
  it("upserts only active profiles with active role assignments", () => {
    expect(sql).toContain("INSERT INTO public.employee_work_schedules");
    expect(sql).toContain("ur.active = true AND p.account_state = 'active'");
    expect(sql).toContain("ON CONFLICT (employee_id) DO UPDATE");
    expect(sql).toContain("ARRAY[1, 2, 3, 4, 5, 6]::SMALLINT[]");
    expect(sql).toContain("'Asia/Manila'");
    expect(sql).toContain("Active staff manager required");
  });

  it("uses exactly the six role hours shared with application and seeds", () => {
    const rows = [...sql.matchAll(/\('([a-z_]+)', TIME '([\d:]+)', TIME '([\d:]+)'\)/g)];
    expect(rows).toHaveLength(6);
    for (const [, role, start, end] of rows) {
      expect(ROLE_WORK_SCHEDULES[role]).toMatchObject({ start_time: start, end_time: end, grace_minutes: 10 });
    }
    expect(sql).not.toMatch(/DELETE FROM|TRUNCATE|DROP TABLE/i);
  });
});
