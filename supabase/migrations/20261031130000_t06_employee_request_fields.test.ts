import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261031130000_t06_employee_request_fields.sql"),
  "utf8",
);

const policy = (name: string) => {
  const start = migration.indexOf(`CREATE POLICY "${name}"`);
  expect(start, `${name} is created`).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf(";", start));
};

const table = (() => {
  const start = migration.indexOf("CREATE TABLE IF NOT EXISTS public.employee_request_attachments");
  expect(start, "the attachment table is created").toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf(");", start));
})();

describe("T06 employee request fields migration", () => {
  it("adds the leave reason limited to the six agreed options", () => {
    expect(migration).toMatch(/ALTER TABLE public\.employee_requests\s+ADD COLUMN IF NOT EXISTS leave_reason TEXT/);
    expect(migration).toMatch(
      /leave_reason IN \('sick', 'vacation', 'emergency', 'bereavement', 'maternity_paternity', 'others'\)/,
    );
  });

  it("makes reason optional and only requires it for a new leave row or Others", () => {
    expect(migration).toMatch(/ALTER TABLE public\.employee_requests\s+ALTER COLUMN reason DROP NOT NULL/);
    expect(migration).toMatch(
      /CHECK \(\s*request_kind <> 'leave'\s*OR \(\s*leave_reason IS NOT NULL\s*AND \(leave_reason <> 'others' OR NULLIF\(btrim\(reason\), ''\) IS NOT NULL\)\s*\)\s*\) NOT VALID/,
    );
  });

  it("files legacy leave rows under Others before the check exists", () => {
    const backfill = migration.indexOf("SET leave_reason = 'others'");
    expect(backfill, "legacy leave rows are backfilled").toBeGreaterThan(-1);
    expect(backfill).toBeLessThan(migration.indexOf("ADD CONSTRAINT chk_employee_request_leave_reason_required"));
    expect(migration).toMatch(/reason = COALESCE\(NULLIF\(btrim\(reason\), ''\), 'Reason not recorded'\)/);
  });

  it("refuses an inserted request that is not the caller's own pending row", () => {
    expect(migration).toMatch(/DROP POLICY IF EXISTS "Staff can insert own requests" ON public\.employee_requests/);
    expect(policy("Staff can insert own requests")).toMatch(
      /WITH CHECK \(employee_id = auth\.uid\(\) AND status = 'pending' AND reviewed_by IS NULL\)/,
    );
  });

  it("stops a staff member from moving their own request past pending or cancelled", () => {
    expect(migration).toMatch(
      /DROP POLICY IF EXISTS "Staff can update own pending requests" ON public\.employee_requests/,
    );
    expect(policy("Staff can update own pending requests")).toMatch(
      /WITH CHECK \(employee_id = auth\.uid\(\) AND status IN \('pending', 'cancelled'\)\)/,
    );
  });

  it("creates the attachment table with a cascading request link", () => {
    expect(table).toContain("id UUID PRIMARY KEY DEFAULT gen_random_uuid()");
    expect(table).toMatch(/request_id UUID NOT NULL REFERENCES public\.employee_requests\(id\) ON DELETE CASCADE/);
    expect(table).toContain("storage_path TEXT NOT NULL");
    expect(table).toContain("original_name TEXT NOT NULL");
    expect(table).toContain("file_kind TEXT NOT NULL DEFAULT 'file' CHECK (file_kind IN ('image', 'file'))");
    expect(table).toContain("file_size INTEGER CHECK (file_size >= 0)");
    expect(table).toContain("uploader_id UUID NOT NULL REFERENCES auth.users(id)");
    expect(table).toContain("created_at TIMESTAMPTZ NOT NULL DEFAULT now()");
  });

  it("keeps attachment writes on the admin client", () => {
    expect(migration).not.toMatch(/employee_request_attachments FOR (INSERT|UPDATE|DELETE)/);
    expect(migration).toMatch(/ALTER TABLE public\.employee_request_attachments ENABLE ROW LEVEL SECURITY/);
  });

  it("lets the request owner, the CEO and the Account Manager read proof files", () => {
    const body = policy("Request owner and reviewers can read attachments");
    expect(body).toMatch(/r\.employee_id = auth\.uid\(\)/);
    expect(body).toMatch(/ur\.role IN \('ceo', 'account_manager'\)/);
    expect(body).toMatch(/ur\.active = true/);
  });

  it("creates a private request-attachments bucket limited to 10 MB images and PDFs", () => {
    const bucket = migration.slice(migration.indexOf("INSERT INTO storage.buckets"));
    expect(bucket).toMatch(/'request-attachments',\s*'request-attachments',\s*false,\s*10485760/);
    expect(bucket).toContain("'image/jpeg'");
    expect(bucket).toContain("'image/png'");
    expect(bucket).toContain("'image/webp'");
    expect(bucket).toContain("'application/pdf'");
    expect(bucket).toMatch(/ON CONFLICT \(id\) DO UPDATE\s+SET public = false/);
    expect(bucket).not.toContain("true");
  });
});
