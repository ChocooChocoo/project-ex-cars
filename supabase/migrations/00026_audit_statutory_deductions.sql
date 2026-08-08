-- 00026: Audit remediation — statutory payroll deductions (G14)
-- SSS / Pag-IBIG / PhilHealth monthly contribution amounts and TIN on compensation records.

ALTER TABLE private.staff_compensation
  ADD COLUMN IF NOT EXISTS sss_contribution_cents BIGINT NOT NULL DEFAULT 0 CHECK (sss_contribution_cents >= 0),
  ADD COLUMN IF NOT EXISTS pagibig_contribution_cents BIGINT NOT NULL DEFAULT 0 CHECK (pagibig_contribution_cents >= 0),
  ADD COLUMN IF NOT EXISTS philhealth_contribution_cents BIGINT NOT NULL DEFAULT 0 CHECK (philhealth_contribution_cents >= 0),
  ADD COLUMN IF NOT EXISTS tin_number TEXT;
