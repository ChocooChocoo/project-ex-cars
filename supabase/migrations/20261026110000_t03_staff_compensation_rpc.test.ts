import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261026110000_t03_staff_compensation_rpc.sql"),
  "utf8",
);

const functionBody = (name: string) => {
  const start = migration.indexOf(`FUNCTION public.${name}(`);
  expect(start, `${name} is defined`).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf("$$;", start));
};

describe("T03 staff compensation RPC migration", () => {
  it("reads compensation for payroll roles only", () => {
    const body = functionBody("list_staff_compensation");
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path = ''/);
    expect(body).toMatch(/ur\.role IN \('ceo', 'account_manager', 'head_accountant'\)/);
    expect(body).toMatch(/FROM private\.staff_compensation/);
  });

  it("lets only the CEO and Account Manager add compensation, as themselves", () => {
    const body = functionBody("add_staff_compensation");
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/ur\.role IN \('ceo', 'account_manager'\)/);
    expect(body).not.toMatch(/head_accountant/);
    expect(body).toMatch(/auth\.uid\(\)\s*\)\s*RETURNING/);
  });

  it("keeps both functions away from anonymous callers", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.list_staff_compensation\(DATE, DATE\) FROM PUBLIC, anon/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.add_staff_compensation\([^)]*\)\s*FROM PUBLIC, anon/);
  });
});
