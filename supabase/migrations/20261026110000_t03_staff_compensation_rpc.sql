-- T03 Phase 7 (AM5): payroll reads and writes staff compensation through RPCs.
-- private.staff_compensation is not exposed to the Data API, so the app's
-- from("staff_compensation") calls failed. These SECURITY DEFINER functions keep the
-- table private and check the caller's role inside the database.

CREATE OR REPLACE FUNCTION public.list_staff_compensation(
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  full_name TEXT,
  base_salary_cents BIGINT,
  effective_from DATE,
  effective_until DATE,
  sss_contribution_cents BIGINT,
  pagibig_contribution_cents BIGINT,
  philhealth_contribution_cents BIGINT,
  tin_number TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles AS ur
    JOIN public.profiles AS p ON p.id = ur.account_id
    WHERE ur.account_id = auth.uid()
      AND ur.active = true
      AND p.account_state = 'active'
      AND ur.role IN ('ceo', 'account_manager', 'head_accountant')
  ) THEN
    RAISE EXCEPTION 'Permission denied: payroll role required.';
  END IF;

  RETURN QUERY
  SELECT sc.id, sc.employee_id, pr.full_name, sc.base_salary_cents, sc.effective_from, sc.effective_until,
    sc.sss_contribution_cents, sc.pagibig_contribution_cents, sc.philhealth_contribution_cents, sc.tin_number,
    sc.created_at
  FROM private.staff_compensation AS sc
  LEFT JOIN public.profiles AS pr ON pr.id = sc.employee_id
  WHERE (p_period_end IS NULL OR sc.effective_from <= p_period_end)
    AND (p_period_start IS NULL OR sc.effective_until IS NULL OR sc.effective_until >= p_period_start)
  ORDER BY sc.effective_from, sc.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_staff_compensation(
  p_employee_id UUID,
  p_base_salary_cents BIGINT,
  p_effective_from DATE,
  p_effective_until DATE DEFAULT NULL,
  p_sss_contribution_cents BIGINT DEFAULT 0,
  p_pagibig_contribution_cents BIGINT DEFAULT 0,
  p_philhealth_contribution_cents BIGINT DEFAULT 0,
  p_tin_number TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles AS ur
    JOIN public.profiles AS p ON p.id = ur.account_id
    WHERE ur.account_id = auth.uid()
      AND ur.active = true
      AND p.account_state = 'active'
      AND ur.role IN ('ceo', 'account_manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the CEO or Account Manager can enter compensation.';
  END IF;

  INSERT INTO private.staff_compensation (
    employee_id, base_salary_cents, effective_from, effective_until, sss_contribution_cents,
    pagibig_contribution_cents, philhealth_contribution_cents, tin_number, created_by
  )
  VALUES (
    p_employee_id, p_base_salary_cents, p_effective_from, p_effective_until, p_sss_contribution_cents,
    p_pagibig_contribution_cents, p_philhealth_contribution_cents, NULLIF(p_tin_number, ''), auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_staff_compensation(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_staff_compensation(UUID, BIGINT, DATE, DATE, BIGINT, BIGINT, BIGINT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_staff_compensation(DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_staff_compensation(UUID, BIGINT, DATE, DATE, BIGINT, BIGINT, BIGINT, TEXT)
  TO authenticated, service_role;
