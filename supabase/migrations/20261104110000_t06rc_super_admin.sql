-- T06 reviewer changes: a Super Admin role for IT Support (maintenance, patching, updates).
-- The Super Admin manages accounts, roles and system settings, like the CEO does, but gets none of the
-- business data (finance, transactions, vehicles): only the policies and RPCs below admit it.
-- The policy and function bodies are copied from their latest definitions with 'super_admin' added.

ALTER TABLE private.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE private.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN (
  'customer', 'supplier', 'ceo', 'account_manager', 'head_accountant',
  'confidential_informant', 'marketing_specialist', 'mechanic',
  'sales_manager', 'head_security', 'super_admin'
));

-- Users screen: read every profile.
DROP POLICY IF EXISTS "Staff can read all profiles" ON public.profiles;
CREATE POLICY "Staff can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid()
      AND role IN ('ceo', 'account_manager', 'head_accountant', 'confidential_informant', 'marketing_specialist', 'mechanic', 'sales_manager', 'head_security', 'super_admin')
      AND active = true
    )
  );

DROP POLICY IF EXISTS "RBAC managers can read access areas" ON public.rbac_access_areas;
CREATE POLICY "RBAC managers can read access areas"
  ON public.rbac_access_areas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "RBAC managers can read actions" ON public.rbac_actions;
CREATE POLICY "RBAC managers can read actions"
  ON public.rbac_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "RBAC managers can read role definitions" ON public.rbac_roles;
CREATE POLICY "RBAC managers can read role definitions"
  ON public.rbac_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "RBAC managers can read permissions" ON public.rbac_permissions;
CREATE POLICY "RBAC managers can read permissions"
  ON public.rbac_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "RBAC managers can read role permissions" ON public.rbac_role_permissions;
CREATE POLICY "RBAC managers can read role permissions"
  ON public.rbac_role_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "RBAC managers can create role definitions" ON public.rbac_roles;
CREATE POLICY "RBAC managers can create role definitions"
  ON public.rbac_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role IN ('ceo', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "RBAC managers can update role definitions" ON public.rbac_roles;
CREATE POLICY "RBAC managers can update role definitions"
  ON public.rbac_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role IN ('ceo', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role IN ('ceo', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "RBAC managers can create permissions" ON public.rbac_permissions;
CREATE POLICY "RBAC managers can create permissions"
  ON public.rbac_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role IN ('ceo', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "RBAC managers can assign permissions" ON public.rbac_role_permissions;
CREATE POLICY "RBAC managers can assign permissions"
  ON public.rbac_role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role IN ('ceo', 'super_admin')
    )
    AND EXISTS (
      SELECT 1 FROM public.rbac_permissions p
      WHERE p.id = permission_id AND p.status = 'active'
    )
  );

DROP POLICY IF EXISTS "RBAC managers can remove permissions" ON public.rbac_role_permissions;
CREATE POLICY "RBAC managers can remove permissions"
  ON public.rbac_role_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role IN ('ceo', 'super_admin')
    )
  );

CREATE OR REPLACE FUNCTION public.update_rbac_role(
  p_role_key TEXT,
  p_description TEXT,
  p_status TEXT,
  p_is_protected BOOLEAN,
  p_permission_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  requested_permission UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM private.user_roles ur
    WHERE ur.account_id = auth.uid()
      AND ur.active = true
      AND ur.role IN ('ceo', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the CEO or the Super Admin can manage RBAC';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Invalid RBAC role status';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.rbac_roles r WHERE r.role_key = p_role_key) THEN
    RAISE EXCEPTION 'RBAC role not found';
  END IF;

  FOREACH requested_permission IN ARRAY COALESCE(p_permission_ids, ARRAY[]::UUID[]) LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.rbac_permissions p
      WHERE p.id = requested_permission
        AND p.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Only active permissions can be assigned';
    END IF;
  END LOOP;

  UPDATE public.rbac_roles
  SET description = NULLIF(trim(p_description), ''),
      status = p_status,
      is_protected = COALESCE(p_is_protected, false)
  WHERE role_key = p_role_key;

  DELETE FROM public.rbac_role_permissions
  WHERE role_key = p_role_key;

  INSERT INTO public.rbac_role_permissions (role_key, permission_id)
  SELECT p_role_key, permission_id
  FROM unnest(COALESCE(p_permission_ids, ARRAY[]::UUID[])) AS selected(permission_id)
  ON CONFLICT DO NOTHING;
END;
$$;

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
DECLARE
  v_allowed_roles TEXT[] := ARRAY[
    'customer', 'supplier', 'ceo', 'account_manager', 'head_accountant',
    'confidential_informant', 'marketing_specialist', 'mechanic',
    'sales_manager', 'head_security', 'super_admin'
  ];
BEGIN
  IF p_assigned_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'assigned_by must match the authenticated user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE account_id = auth.uid()
      AND active = true
      AND role IN ('ceo', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the CEO or the Super Admin can assign roles';
  END IF;

  IF p_role IS NULL OR NOT (p_role = ANY(v_allowed_roles)) THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  INSERT INTO private.user_roles (account_id, role, assigned_by, active)
  VALUES (p_account_id, p_role, auth.uid(), true)
  ON CONFLICT (account_id)
  DO UPDATE SET role = EXCLUDED.role, assigned_by = auth.uid(), assigned_at = now(), active = true;

  RETURN 'ok';
END;
$$;

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
      AND ur.role IN ('ceo', 'account_manager', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the CEO, the Account Manager or the Super Admin can list all roles';
  END IF;

  RETURN QUERY
    SELECT ur.account_id, ur.role
    FROM private.user_roles ur
    WHERE ur.active = true;
END;
$$;
