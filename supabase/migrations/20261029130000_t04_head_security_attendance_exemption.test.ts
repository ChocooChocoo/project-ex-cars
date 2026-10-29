import { describe, expect, it } from "vitest";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "supabase/migrations");
const original = readFileSync(resolve(root, "20260809134551_task18_staff_attendance.sql"), "utf8");
const path = resolve(root, "20261029130000_t04_head_security_attendance_exemption.sql");
const migration = existsSync(path) ? readFileSync(path, "utf8") : "";
const pattern = /CREATE OR REPLACE FUNCTION public\.(\w+)\([\s\S]*?\$\$;/g;
const baseline = new Map([...original.matchAll(pattern)].map((match) => [match[1], match[0]]));
const updated = new Map([...migration.matchAll(pattern)].map((match) => [match[1], match[0]]));

describe("Head Security attendance exemption migration", () => {
  it.each([
    "get_my_attendance_state",
    "clock_in_attendance",
    "clock_out_attendance",
    "save_staff_record",
  ])("%s preserves its full definition except the attendance-role exclusion", (name) => {
    const expected = baseline
      .get(name)
      ?.replaceAll("NOT IN ('customer', 'supplier')", "NOT IN ('customer', 'supplier', 'head_security')");
    expect(expected).toBeDefined();
    expect(updated.get(name)).toBe(expected);
  });

  it("replaces only four functions, with no top-level data or permission changes", () => {
    expect(updated.size).toBe(4);
    expect(
      migration
        .replace(pattern, "")
        .replace(/--[^\n]*/g, "")
        .trim(),
    ).toBe("");
  });
});
