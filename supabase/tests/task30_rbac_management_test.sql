BEGIN;

SELECT no_plan();

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task30-manager@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task30-customer@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

UPDATE private.user_roles
SET role = 'account_manager', active = true
WHERE account_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

UPDATE private.user_roles
SET role = 'customer', active = true
WHERE account_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

SELECT has_table('public', 'rbac_access_areas', 'access-area catalog exists');
SELECT has_table('public', 'rbac_actions', 'action catalog exists');
SELECT has_table('public', 'rbac_roles', 'role definitions exist');
SELECT has_table('public', 'rbac_permissions', 'permission definitions exist');
SELECT has_table('public', 'rbac_role_permissions', 'role-permission assignments exist');
SELECT has_column('public', 'rbac_permissions', 'access_label', 'permission access label exists');
SELECT has_column('public', 'rbac_permissions', 'permission_key', 'generated permission key exists');
SELECT has_index('public', 'rbac_role_permissions', 'rbac_role_permissions_permission_id_idx', 'reverse permission lookup is indexed');
SELECT has_function('public', 'update_rbac_role', ARRAY['text', 'text', 'text', 'boolean', 'uuid[]'], 'atomic role update RPC exists');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_access_areas), 30, 'all fixed access areas are seeded');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_actions), 30, 'all fixed actions are seeded');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_permissions), 141, 'all system permissions are seeded');
SELECT is(
  (SELECT count(*)::INTEGER FROM public.rbac_permissions WHERE permission_key IN (
    'dashboard.read',
    'finance.read', 'finance.create', 'finance.submit', 'finance.verify', 'finance.approve', 'finance.reject',
    'finance.release', 'finance.receive', 'finance.mark_paid',
    'vehicles.read', 'vehicles.create', 'vehicles.update', 'vehicles.delete', 'vehicles.publish', 'vehicles.propose',
    'vehicles.approve', 'vehicles.reject', 'vehicles.upload', 'vehicles.archive',
    'staff_showroom.read',
    'content.read', 'content.create', 'content.update', 'content.delete', 'content.publish',
    'inspections.read', 'inspections.create', 'inspections.submit', 'inspections.print',
    'inquiries.read', 'inquiries.send', 'inquiries.upload', 'inquiries.assign', 'inquiries.schedule',
    'inquiries.handoff', 'inquiries.accept', 'inquiries.review',
    'recommendations.read',
    'transactions.read', 'transactions.create', 'transactions.review', 'transactions.approve', 'transactions.reject',
    'transactions.complete', 'transactions.cancel', 'transactions.record_payment', 'transactions.verify',
    'transactions.propose', 'transactions.start', 'transactions.upload', 'transactions.assign', 'transactions.waive',
    'transactions.instruct_repossession',
    'roadmap.read', 'roadmap.create', 'roadmap.update', 'roadmap.delete',
    'suppliers.read', 'suppliers.create', 'suppliers.approve', 'suppliers.reject', 'suppliers.upload', 'suppliers.verify',
    'staff_records.read', 'staff_records.update', 'staff_records.submit', 'staff_records.schedule',
    'attendance.read', 'attendance.start', 'attendance.complete', 'attendance.review',
    'employee_requests.read', 'employee_requests.submit', 'employee_requests.cancel', 'employee_requests.review',
    'employee_requests.approve', 'employee_requests.reject',
    'payroll.read', 'payroll.create', 'payroll.update', 'payroll.review', 'payroll.approve', 'payroll.reject',
    'payroll.finalize',
    'payslips.read', 'payslips.update', 'payslips.mark_paid', 'payslips.print',
    'field_cases.read', 'field_cases.create', 'field_cases.update', 'field_cases.assign', 'field_cases.accept',
    'field_cases.start', 'field_cases.complete', 'field_cases.cancel',
    'security_duty_checks.read', 'security_duty_checks.start', 'security_duty_checks.upload',
    'security_duty_checks.complete',
    'reports.read', 'reports.submit', 'reports.review',
    'announcements.read', 'announcements.create', 'announcements.publish', 'announcements.expire',
    'announcements.archive',
    'supplier_messages.read', 'supplier_messages.send',
    'roles.read', 'roles.create', 'roles.update', 'roles.assign',
    'users.read', 'users.create',
    'customer_showroom.read',
    'customer_recommendations.read', 'customer_recommendations.start', 'customer_recommendations.submit',
    'customer_inquiries.read', 'customer_inquiries.create', 'customer_inquiries.send', 'customer_inquiries.upload',
    'customer_inquiries.submit',
    'customer_transactions.read', 'customer_transactions.create', 'customer_transactions.update',
    'customer_transactions.upload', 'customer_transactions.cancel', 'customer_transactions.print',
    'vehicle_requests.read', 'vehicle_requests.submit', 'vehicle_requests.cancel',
    'sell_vehicle.read', 'sell_vehicle.submit', 'sell_vehicle.cancel',
    'favourites.read', 'favourites.create', 'favourites.delete'
  )),
  141,
  'the exact system permission combinations are seeded'
);
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_roles), 8, 'all managed roles are seeded');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_role_permissions), 232, 'all system role mappings are seeded');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_role_permissions WHERE role_key = 'supplier'), 26, 'supplier mappings are exact');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_role_permissions WHERE role_key = 'account_manager'), 59, 'Account Manager mappings are exact');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_role_permissions WHERE role_key = 'head_accountant'), 34, 'Head Accountant mappings are exact');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_role_permissions WHERE role_key = 'confidential_informant'), 17, 'Confidential Informant mappings are exact');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_role_permissions WHERE role_key = 'marketing_specialist'), 24, 'Marketing Specialist mappings are exact');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_role_permissions WHERE role_key = 'mechanic'), 16, 'Mechanic mappings are exact');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_role_permissions WHERE role_key = 'sales_manager'), 41, 'Sales Manager mappings are exact');
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_role_permissions WHERE role_key = 'head_security'), 15, 'Head Security mappings are exact');
SELECT is(
  (SELECT count(*)::INTEGER FROM (SELECT role_key, permission_id FROM public.rbac_role_permissions GROUP BY role_key, permission_id) unique_mappings),
  232,
  'role-permission mappings contain no duplicates'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.rbac_roles
    WHERE status <> 'active' OR is_protected IS DISTINCT FROM true
  ),
  'seeded roles are active protected system roles'
);
SELECT is((SELECT count(*)::INTEGER FROM public.rbac_roles WHERE role_key IN (
  'supplier', 'account_manager', 'head_accountant', 'confidential_informant',
  'marketing_specialist', 'mechanic', 'sales_manager', 'head_security'
)), 8, 'only the eight managed role keys are seeded');

SELECT is(
  (SELECT permission_key FROM public.rbac_permissions WHERE access_area_key = 'vehicles' AND action_key = 'read'),
  'vehicles.read',
  'permission key is generated from area and action'
);

SELECT is(
  (SELECT access_label FROM public.rbac_permissions WHERE access_area_key = 'vehicles' AND action_key = 'read'),
  'Read Vehicles',
  'permission label is generated for users'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.rbac_role_permissions rp
    JOIN public.rbac_permissions p ON p.id = rp.permission_id
    WHERE rp.role_key = 'supplier' AND p.permission_key = 'customer_transactions.print'
  ),
  'supplier receives customer transaction print access'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.rbac_role_permissions rp
    JOIN public.rbac_permissions p ON p.id = rp.permission_id
    WHERE rp.role_key = 'account_manager' AND p.permission_key = 'roles.assign'
  ),
  'Account Manager receives RBAC assignment access'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.rbac_role_permissions rp
    JOIN public.rbac_permissions p ON p.id = rp.permission_id
    WHERE rp.role_key = 'head_accountant' AND p.permission_key = 'transactions.instruct_repossession'
  ),
  'Head Accountant receives repossession instruction access'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.rbac_role_permissions rp
    JOIN public.rbac_permissions p ON p.id = rp.permission_id
    WHERE rp.role_key = 'marketing_specialist' AND p.permission_key = 'vehicles.propose'
  ),
  'Marketing Specialist receives vehicle proposal access'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.rbac_role_permissions rp
    JOIN public.rbac_permissions p ON p.id = rp.permission_id
    WHERE rp.role_key = 'sales_manager' AND p.permission_key = 'field_cases.complete'
  ),
  'Sales Manager receives field-case completion access'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.rbac_role_permissions rp
    JOIN public.rbac_permissions p ON p.id = rp.permission_id
    WHERE (rp.role_key, p.permission_key) IN (
      ('account_manager', 'transactions.record_payment'),
      ('account_manager', 'transactions.propose'),
      ('account_manager', 'transactions.create'),
      ('head_accountant', 'payroll.finalize'),
      ('head_accountant', 'payslips.mark_paid'),
      ('confidential_informant', 'field_cases.create'),
      ('mechanic', 'field_cases.update')
    )
  ),
  'known server/RLS-blocked combinations remain unassigned'
);

SELECT ok(has_table_privilege('authenticated', 'public.rbac_roles', 'INSERT'), 'authenticated can submit role definitions');
SELECT ok(has_table_privilege('authenticated', 'public.rbac_permissions', 'INSERT'), 'authenticated can submit permissions');
SELECT ok(NOT has_table_privilege('anon', 'public.rbac_roles', 'SELECT'), 'anon cannot read role definitions');
SELECT ok(has_function_privilege('authenticated', 'public.update_rbac_role(text,text,text,boolean,uuid[])', 'EXECUTE'), 'manager RPC is callable by authenticated users');

-- The seed is intentionally bootstrap-only. Remove one seeded role inside this
-- rollback transaction so the manager-create test still exercises the policy.
DELETE FROM public.rbac_role_permissions WHERE role_key = 'supplier';
DELETE FROM public.rbac_roles WHERE role_key = 'supplier';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

SELECT lives_ok(
  $$INSERT INTO public.rbac_roles (role_key, description, status, is_protected)
    VALUES ('supplier', 'Supplier role', 'active', false)$$,
  'an active Account Manager can create a managed role'
);

SELECT lives_ok(
  $$INSERT INTO public.rbac_permissions (access_area_key, action_key, description, status)
    VALUES ('dashboard', 'update', NULL, 'active')$$,
  'an active Account Manager can create a permission'
);

SELECT lives_ok(
  $$INSERT INTO public.rbac_permissions (access_area_key, action_key, description, status)
    VALUES ('dashboard', 'delete', NULL, 'inactive')$$,
  'an active Account Manager can stage an inactive permission'
);

SELECT throws_matching(
  $$INSERT INTO public.rbac_permissions (access_area_key, action_key, description, status)
    VALUES ('vehicles', 'read', 'Duplicate', 'active')$$,
  'duplicate key|unique constraint',
  'duplicate area/action permissions are rejected'
);

SELECT lives_ok(
  $$SELECT public.update_rbac_role(
    'supplier',
    'Supplier role',
    'active',
    true,
    ARRAY[
      (SELECT id FROM public.rbac_permissions WHERE access_area_key = 'vehicles' AND action_key = 'read'),
      (SELECT id FROM public.rbac_permissions WHERE access_area_key = 'vehicles' AND action_key = 'update')
    ]::uuid[]
  )$$,
  'active permissions can be assigned atomically'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM public.rbac_role_permissions WHERE role_key = 'supplier'),
  2,
  'role assignment stores both selected permissions'
);

SELECT throws_matching(
  $$SELECT public.update_rbac_role(
    'supplier',
    'Supplier role',
    'active',
    true,
    ARRAY[(SELECT id FROM public.rbac_permissions WHERE access_area_key = 'dashboard' AND action_key = 'delete')]::uuid[]
  )$$,
  'Only active permissions',
  'inactive permissions cannot be assigned'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM public.rbac_role_permissions WHERE role_key = 'supplier'),
  2,
  'failed assignment leaves the previous permissions intact'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

SELECT throws_matching(
  $$INSERT INTO public.rbac_roles (role_key, description) VALUES ('mechanic', 'No access')$$,
  'row-level security|permission denied',
  'customers cannot create managed roles'
);

SELECT throws_matching(
  $$INSERT INTO public.rbac_permissions (access_area_key, action_key) VALUES ('vehicles', 'create')$$,
  'row-level security|permission denied',
  'customers cannot create permissions'
);

SELECT throws_matching(
  $$SELECT public.update_rbac_role('supplier', 'No access', 'active', false, ARRAY[]::uuid[])$$,
  'Permission denied|row-level security',
  'customers cannot update managed roles'
);

SELECT * FROM finish();
ROLLBACK;
