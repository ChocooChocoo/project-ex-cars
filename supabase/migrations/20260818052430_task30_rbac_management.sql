-- Task 30: RBAC role definitions, permission catalogs, and role assignments.
-- These records configure the management UI only. Existing route/action/RLS
-- authorization remains authoritative for application access.

CREATE TABLE public.rbac_access_areas (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE
);

CREATE TABLE public.rbac_actions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE
);

CREATE TABLE public.rbac_roles (
  role_key TEXT PRIMARY KEY CHECK (
    role_key IN (
      'supplier',
      'account_manager',
      'head_accountant',
      'confidential_informant',
      'marketing_specialist',
      'mechanic',
      'sales_manager',
      'head_security'
    )
  ),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  is_protected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rbac_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_area_key TEXT NOT NULL REFERENCES public.rbac_access_areas(key),
  action_key TEXT NOT NULL REFERENCES public.rbac_actions(key),
  access_label TEXT GENERATED ALWAYS AS (
    initcap(replace(action_key, '_', ' ')) || ' ' || initcap(replace(access_area_key, '_', ' '))
  ) STORED,
  permission_key TEXT GENERATED ALWAYS AS (access_area_key || '.' || action_key) STORED UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (access_area_key, action_key)
);

CREATE TABLE public.rbac_role_permissions (
  role_key TEXT NOT NULL REFERENCES public.rbac_roles(role_key) ON DELETE RESTRICT,
  permission_id UUID NOT NULL REFERENCES public.rbac_permissions(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_key, permission_id)
);

CREATE INDEX rbac_role_permissions_permission_id_idx
  ON public.rbac_role_permissions(permission_id);

CREATE TRIGGER rbac_roles_updated_at
  BEFORE UPDATE ON public.rbac_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.rbac_access_areas (key, label, sort_order)
VALUES
  ('dashboard', 'Dashboard', 1),
  ('finance', 'Finance', 2),
  ('vehicles', 'Vehicles', 3),
  ('staff_showroom', 'Staff Showroom', 4),
  ('content', 'Content', 5),
  ('inspections', 'Inspections', 6),
  ('inquiries', 'Inquiries', 7),
  ('recommendations', 'Recommendations', 8),
  ('transactions', 'Transactions', 9),
  ('roadmap', 'Roadmap', 10),
  ('suppliers', 'Suppliers', 11),
  ('staff_records', 'Staff Records', 12),
  ('attendance', 'Attendance', 13),
  ('employee_requests', 'Employee Requests', 14),
  ('payroll', 'Payroll', 15),
  ('payslips', 'Payslips', 16),
  ('field_cases', 'Field Cases', 17),
  ('security_duty_checks', 'Security Duty Checks', 18),
  ('reports', 'Reports', 19),
  ('announcements', 'Announcements', 20),
  ('supplier_messages', 'Supplier Messages', 21),
  ('roles', 'Roles', 22),
  ('users', 'Users', 23),
  ('customer_showroom', 'Customer Showroom', 24),
  ('customer_recommendations', 'Customer Recommendations', 25),
  ('customer_inquiries', 'Customer Inquiries', 26),
  ('customer_transactions', 'Customer Transactions', 27),
  ('vehicle_requests', 'Vehicle Requests', 28),
  ('sell_vehicle', 'Sell Vehicle', 29),
  ('favourites', 'Favourites', 30)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.rbac_actions (key, label, sort_order)
VALUES
  ('read', 'Read', 1),
  ('create', 'Create', 2),
  ('update', 'Update', 3),
  ('delete', 'Delete', 4),
  ('submit', 'Submit', 5),
  ('review', 'Review', 6),
  ('approve', 'Approve', 7),
  ('reject', 'Reject', 8),
  ('assign', 'Assign', 9),
  ('verify', 'Verify', 10),
  ('upload', 'Upload', 11),
  ('publish', 'Publish', 12),
  ('archive', 'Archive', 13),
  ('expire', 'Expire', 14),
  ('release', 'Release', 15),
  ('receive', 'Receive', 16),
  ('mark_paid', 'Mark Paid', 17),
  ('complete', 'Complete', 18),
  ('cancel', 'Cancel', 19),
  ('schedule', 'Schedule', 20),
  ('send', 'Send', 21),
  ('finalize', 'Finalize', 22),
  ('record_payment', 'Record Payment', 23),
  ('waive', 'Waive', 24),
  ('instruct_repossession', 'Instruct Repossession', 25),
  ('propose', 'Propose', 26),
  ('handoff', 'Handoff', 27),
  ('accept', 'Accept', 28),
  ('start', 'Start', 29),
  ('print', 'Print', 30)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.rbac_access_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_role_permissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.rbac_access_areas,
  public.rbac_actions,
  public.rbac_roles,
  public.rbac_permissions,
  public.rbac_role_permissions
FROM anon;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.rbac_access_areas, public.rbac_actions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.rbac_roles TO authenticated;
GRANT UPDATE (description, status, is_protected) ON TABLE public.rbac_roles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.rbac_permissions TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.rbac_role_permissions TO authenticated;

CREATE POLICY "RBAC managers can read access areas"
  ON public.rbac_access_areas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "RBAC managers can read actions"
  ON public.rbac_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "RBAC managers can read role definitions"
  ON public.rbac_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "RBAC managers can create role definitions"
  ON public.rbac_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "RBAC managers can update role definitions"
  ON public.rbac_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "RBAC managers can read permissions"
  ON public.rbac_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "RBAC managers can create permissions"
  ON public.rbac_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "RBAC managers can read role permissions"
  ON public.rbac_role_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "RBAC managers can assign permissions"
  ON public.rbac_role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager')
    )
    AND EXISTS (
      SELECT 1
      FROM public.rbac_permissions p
      WHERE p.id = permission_id
        AND p.status = 'active'
    )
  );

CREATE POLICY "RBAC managers can remove permissions"
  ON public.rbac_role_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles ur
      WHERE ur.account_id = auth.uid()
        AND ur.active = true
        AND ur.role IN ('ceo', 'account_manager')
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
      AND ur.role IN ('ceo', 'account_manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only CEO or Account Manager can manage RBAC';
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
