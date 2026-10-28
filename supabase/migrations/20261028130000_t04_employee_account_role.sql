-- T04 E6: the CEO or the Account Manager creates an account for a new employee.
--
-- assign_user_role stays CEO-only (T03 R2). This separate function only turns a freshly created account,
-- which the profile trigger gave the default 'customer' role, into a staff account. It never changes an
-- existing staff role and never grants 'ceo'. Only the server (service_role) may call it; the server
-- action checks the caller first, and the function checks the actor again here.

CREATE OR REPLACE FUNCTION public.set_new_employee_role(
  p_account_id UUID,
  p_role TEXT,
  p_assigned_by UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_allowed_roles TEXT[] := ARRAY[
    'account_manager', 'head_accountant', 'confidential_informant',
    'marketing_specialist', 'mechanic', 'sales_manager', 'head_security'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE account_id = p_assigned_by
      AND active = true
      AND role IN ('ceo', 'account_manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the CEO or the Account Manager can create employee accounts';
  END IF;

  IF p_role IS NULL OR NOT (p_role = ANY(v_allowed_roles)) THEN
    RAISE EXCEPTION 'Invalid employee role: %', p_role;
  END IF;

  UPDATE private.user_roles
  SET role = p_role, assigned_by = p_assigned_by, assigned_at = now()
  WHERE account_id = p_account_id AND active = true AND role = 'customer';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account % is not a new account', p_account_id;
  END IF;

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.set_new_employee_role(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_new_employee_role(UUID, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.set_new_employee_role(UUID, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_new_employee_role(UUID, TEXT, UUID) TO service_role;
