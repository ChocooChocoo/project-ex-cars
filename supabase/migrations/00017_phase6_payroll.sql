-- 00017: Phase 6 — Payroll (compensation, payroll runs, payslips, approvals)
-- Compensation is private; employees see only their payslips.

-- Staff compensation: private salary and benefit records
CREATE TABLE IF NOT EXISTS private.staff_compensation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_salary_cents BIGINT NOT NULL CHECK (base_salary_cents > 0),
  effective_from DATE NOT NULL,
  effective_until DATE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_comp_period CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

-- Payroll runs: one batch per pay period
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'finalized', 'cancelled')),
  prepared_by UUID NOT NULL REFERENCES public.profiles(id),
  total_gross_cents BIGINT NOT NULL DEFAULT 0,
  total_deductions_cents BIGINT NOT NULL DEFAULT 0,
  total_net_cents BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payroll_period CHECK (period_end >= period_start),
  CONSTRAINT uq_payroll_period UNIQUE (period_start, period_end)
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account Manager and CEO can read runs" ON public.payroll_runs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager', 'head_accountant')
  ));

CREATE POLICY "Account Manager can create and update runs" ON public.payroll_runs
  FOR ALL USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager')
  ));

-- Payslips: one per employee per payroll run
CREATE TABLE IF NOT EXISTS public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gross_cents BIGINT NOT NULL DEFAULT 0,
  deductions_cents BIGINT NOT NULL DEFAULT 0,
  net_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payslip_employee_run UNIQUE (employee_id, payroll_run_id)
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can read own finalized payslips" ON public.payslips
  FOR SELECT USING (
    employee_id = auth.uid() AND status = 'finalized'
  );

CREATE POLICY "Account Manager and CEO can read all payslips" ON public.payslips
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager', 'head_accountant')
  ));

CREATE POLICY "Account Manager can manage payslips before finalization" ON public.payslips
  FOR ALL USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager')
  ));

-- Payslip items: line items for earnings and deductions
CREATE TABLE IF NOT EXISTS public.payslip_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('earning', 'deduction')),
  label TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  source_value TEXT,
  calculation_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee can read own items" ON public.payslip_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.payslips ps WHERE ps.id = payslip_id AND ps.employee_id = auth.uid()
  ));

CREATE POLICY "Authorized staff can read all items" ON public.payslip_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager', 'head_accountant')
  ));

CREATE POLICY "Account Manager can manage items" ON public.payslip_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager')
  ));

-- Payroll approvals: immutable approval events
CREATE TABLE IF NOT EXISTS public.payroll_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 1,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized staff can read approvals" ON public.payroll_approvals
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager', 'head_accountant')
  ));

CREATE POLICY "CEO and Head Accountant can approve" ON public.payroll_approvals
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'head_accountant')
  ));
