BEGIN;

-- The Head Accountant is a reviewer and finalizer, so the RLS-bound server actions must be able
-- to update the run and its payslips. Without this the action returned success after 0 rows.
CREATE POLICY "Head accountant updates payroll runs" ON public.payroll_runs
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE account_id = auth.uid() AND active AND role = 'head_accountant'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE account_id = auth.uid() AND active AND role = 'head_accountant'
  ));

CREATE POLICY "Head accountant updates payslips" ON public.payslips
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE account_id = auth.uid() AND active AND role = 'head_accountant'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE account_id = auth.uid() AND active AND role = 'head_accountant'
  ));

COMMIT;
