-- Add assign_user_role RPC function (bridges private.user_roles for PostgREST access)
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_account_id UUID,
  p_role TEXT,
  p_assigned_by UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO private.user_roles (account_id, role, assigned_by, active)
  VALUES (p_account_id, p_role, p_assigned_by, true)
  ON CONFLICT (account_id)
  DO UPDATE SET role = EXCLUDED.role, assigned_by = EXCLUDED.assigned_by, assigned_at = now(), active = true;
  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_user_role(UUID, TEXT, UUID) TO authenticated;
