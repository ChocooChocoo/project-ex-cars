-- T03 R2/R3 and AM6 (docs/implementation-plan/client-change-requests/phase-2.md).
-- Only the CEO may grant RBAC access. The Account Manager keeps managing employees (Staff Records, payroll,
-- attendance) but can no longer change role permissions or assign roles, and no longer reads Field Cases.
-- Named with a timestamp so it runs after 20260818052430_task30_rbac_management.sql on a fresh reset.

-- ============================================================
-- RBAC write policies: CEO only (reads stay with the CEO and the Account Manager).
-- ============================================================

DROP POLICY IF EXISTS "RBAC managers can create role definitions" ON public.rbac_roles;
CREATE POLICY "RBAC managers can create role definitions"
  ON public.rbac_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role = 'ceo'
    )
  );

DROP POLICY IF EXISTS "RBAC managers can update role definitions" ON public.rbac_roles;
CREATE POLICY "RBAC managers can update role definitions"
  ON public.rbac_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role = 'ceo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role = 'ceo'
    )
  );

DROP POLICY IF EXISTS "RBAC managers can create permissions" ON public.rbac_permissions;
CREATE POLICY "RBAC managers can create permissions"
  ON public.rbac_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role = 'ceo'
    )
  );

DROP POLICY IF EXISTS "RBAC managers can assign permissions" ON public.rbac_role_permissions;
CREATE POLICY "RBAC managers can assign permissions"
  ON public.rbac_role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role = 'ceo'
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
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role = 'ceo'
    )
  );

-- ============================================================
-- update_rbac_role: same body as task30, CEO-only guard.
-- ============================================================

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
      AND ur.role = 'ceo'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the CEO can manage RBAC';
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

REVOKE ALL ON FUNCTION public.update_rbac_role(TEXT, TEXT, TEXT, BOOLEAN, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_rbac_role(TEXT, TEXT, TEXT, BOOLEAN, UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_rbac_role(TEXT, TEXT, TEXT, BOOLEAN, UUID[]) TO authenticated;

-- ============================================================
-- assign_user_role: same body as 00013, CEO-only guard.
-- ============================================================

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
    'sales_manager', 'head_security'
  ];
BEGIN
  IF p_assigned_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'assigned_by must match the authenticated user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE account_id = auth.uid()
      AND active = true
      AND role = 'ceo'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the CEO can assign roles';
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

REVOKE ALL ON FUNCTION public.assign_user_role(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_user_role(UUID, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(UUID, TEXT, UUID) TO authenticated;

-- ============================================================
-- Account Manager's RBAC bundle: no role granting, no Field Cases.
-- ============================================================

DELETE FROM public.rbac_role_permissions rp
USING public.rbac_permissions p
WHERE rp.permission_id = p.id
  AND rp.role_key = 'account_manager'
  AND p.permission_key IN ('roles.read', 'roles.create', 'roles.update', 'roles.assign', 'field_cases.read');

-- ============================================================
-- Field Cases: the Account Manager no longer reads them (same list as 00038 without account_manager).
-- ============================================================

DROP POLICY IF EXISTS "Staff can read field cases" ON public.field_cases;
CREATE POLICY "Staff can read field cases"
  ON public.field_cases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true
    AND role IN ('ceo', 'sales_manager', 'confidential_informant', 'mechanic', 'head_accountant')
  ));
