-- 00037: Fix ambiguous column references in get_all_user_roles()
-- The RETURNS TABLE(account_id UUID, role TEXT) output parameters collided with
-- unqualified column references inside the permission check, raising
-- error 42702. Qualify every column with the table alias.

CREATE OR REPLACE FUNCTION public.get_all_user_roles()
RETURNS TABLE(account_id UUID, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles ur
    WHERE ur.account_id = auth.uid()
      AND ur.active = true
      AND ur.role IN ('ceo', 'account_manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only CEO or Account Manager can list all roles';
  END IF;

  RETURN QUERY
    SELECT ur.account_id, ur.role
    FROM private.user_roles ur
    WHERE ur.active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_user_roles() TO authenticated;
