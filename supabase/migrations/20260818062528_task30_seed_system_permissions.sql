-- Task 30: seed system permission definitions and bootstrap managed roles.
-- These records remain RBAC management metadata; existing route, action, RPC,
-- navigation, and RLS authorization stays authoritative.

INSERT INTO public.rbac_permissions (access_area_key, action_key, description, status)
SELECT seed.access_area_key, seed.action_key, NULL, 'active'
FROM (
  VALUES
    ('dashboard', 'read'),
    ('finance', 'read'), ('finance', 'create'), ('finance', 'submit'), ('finance', 'verify'),
    ('finance', 'approve'), ('finance', 'reject'), ('finance', 'release'), ('finance', 'receive'),
    ('finance', 'mark_paid'),
    ('vehicles', 'read'), ('vehicles', 'create'), ('vehicles', 'update'), ('vehicles', 'delete'),
    ('vehicles', 'publish'), ('vehicles', 'propose'), ('vehicles', 'approve'), ('vehicles', 'reject'),
    ('vehicles', 'upload'), ('vehicles', 'archive'),
    ('staff_showroom', 'read'),
    ('content', 'read'), ('content', 'create'), ('content', 'update'), ('content', 'delete'),
    ('content', 'publish'),
    ('inspections', 'read'), ('inspections', 'create'), ('inspections', 'submit'), ('inspections', 'print'),
    ('inquiries', 'read'), ('inquiries', 'send'), ('inquiries', 'upload'), ('inquiries', 'assign'),
    ('inquiries', 'schedule'), ('inquiries', 'handoff'), ('inquiries', 'accept'), ('inquiries', 'review'),
    ('recommendations', 'read'),
    ('transactions', 'read'), ('transactions', 'create'), ('transactions', 'review'),
    ('transactions', 'approve'), ('transactions', 'reject'), ('transactions', 'complete'),
    ('transactions', 'cancel'), ('transactions', 'record_payment'), ('transactions', 'verify'),
    ('transactions', 'propose'), ('transactions', 'start'), ('transactions', 'upload'),
    ('transactions', 'assign'), ('transactions', 'waive'), ('transactions', 'instruct_repossession'),
    ('roadmap', 'read'), ('roadmap', 'create'), ('roadmap', 'update'), ('roadmap', 'delete'),
    ('suppliers', 'read'), ('suppliers', 'create'), ('suppliers', 'approve'), ('suppliers', 'reject'),
    ('suppliers', 'upload'), ('suppliers', 'verify'),
    ('staff_records', 'read'), ('staff_records', 'update'), ('staff_records', 'submit'),
    ('staff_records', 'schedule'),
    ('attendance', 'read'), ('attendance', 'start'), ('attendance', 'complete'), ('attendance', 'review'),
    ('employee_requests', 'read'), ('employee_requests', 'submit'), ('employee_requests', 'cancel'),
    ('employee_requests', 'review'), ('employee_requests', 'approve'), ('employee_requests', 'reject'),
    ('payroll', 'read'), ('payroll', 'create'), ('payroll', 'update'), ('payroll', 'review'),
    ('payroll', 'approve'), ('payroll', 'reject'), ('payroll', 'finalize'),
    ('payslips', 'read'), ('payslips', 'update'), ('payslips', 'mark_paid'), ('payslips', 'print'),
    ('field_cases', 'read'), ('field_cases', 'create'), ('field_cases', 'update'), ('field_cases', 'assign'),
    ('field_cases', 'accept'), ('field_cases', 'start'), ('field_cases', 'complete'), ('field_cases', 'cancel'),
    ('security_duty_checks', 'read'), ('security_duty_checks', 'start'),
    ('security_duty_checks', 'upload'), ('security_duty_checks', 'complete'),
    ('reports', 'read'), ('reports', 'submit'), ('reports', 'review'),
    ('announcements', 'read'), ('announcements', 'create'), ('announcements', 'publish'),
    ('announcements', 'expire'), ('announcements', 'archive'),
    ('supplier_messages', 'read'), ('supplier_messages', 'send'),
    ('roles', 'read'), ('roles', 'create'), ('roles', 'update'), ('roles', 'assign'),
    ('users', 'read'), ('users', 'create'),
    ('customer_showroom', 'read'),
    ('customer_recommendations', 'read'), ('customer_recommendations', 'start'),
    ('customer_recommendations', 'submit'),
    ('customer_inquiries', 'read'), ('customer_inquiries', 'create'), ('customer_inquiries', 'send'),
    ('customer_inquiries', 'upload'), ('customer_inquiries', 'submit'),
    ('customer_transactions', 'read'), ('customer_transactions', 'create'),
    ('customer_transactions', 'update'), ('customer_transactions', 'upload'),
    ('customer_transactions', 'cancel'), ('customer_transactions', 'print'),
    ('vehicle_requests', 'read'), ('vehicle_requests', 'submit'), ('vehicle_requests', 'cancel'),
    ('sell_vehicle', 'read'), ('sell_vehicle', 'submit'), ('sell_vehicle', 'cancel'),
    ('favourites', 'read'), ('favourites', 'create'), ('favourites', 'delete')
) AS seed(access_area_key, action_key)
ON CONFLICT (access_area_key, action_key) DO NOTHING;

WITH new_roles AS (
  INSERT INTO public.rbac_roles (role_key, description, status, is_protected)
  VALUES
    ('supplier', 'Uses supplier messaging and customer-facing vehicle workflows.', 'active', true),
    ('account_manager', 'Manages accounts, RBAC, suppliers, staff records, inquiries, requests, and payroll preparation.', 'active', true),
    ('head_accountant', 'Handles finance verification, disbursements, transaction payments, reports, and recovery instructions.', 'active', true),
    ('confidential_informant', 'Handles field acquisition, delivery, recovery requests, and related operational records.', 'active', true),
    ('marketing_specialist', 'Maintains vehicle listings, media, pricing proposals, showroom content, and marketing content.', 'active', true),
    ('mechanic', 'Creates vehicle inspections and records inspection checklist results.', 'active', true),
    ('sales_manager', 'Handles inquiries, transaction decisions, showroom operations, and field cases.', 'active', true),
    ('head_security', 'Records security duty checks and uses staff self-service modules.', 'active', true)
  ON CONFLICT (role_key) DO NOTHING
  RETURNING role_key
), common_permissions(permission_key) AS (
  VALUES
    ('dashboard.read'), ('vehicles.read'),
    ('attendance.read'), ('attendance.start'), ('attendance.complete'),
    ('employee_requests.read'), ('employee_requests.submit'), ('employee_requests.cancel'),
    ('payslips.read'), ('payslips.print'), ('announcements.read')
), staff_roles(role_key) AS (
  VALUES
    ('account_manager'), ('head_accountant'), ('confidential_informant'),
    ('marketing_specialist'), ('mechanic'), ('sales_manager'), ('head_security')
), role_permissions(role_key, permission_key) AS (
  SELECT staff_roles.role_key, common_permissions.permission_key
  FROM staff_roles
  CROSS JOIN common_permissions
  UNION ALL
  VALUES
    ('supplier', 'customer_showroom.read'),
    ('supplier', 'customer_recommendations.read'), ('supplier', 'customer_recommendations.start'), ('supplier', 'customer_recommendations.submit'),
    ('supplier', 'customer_inquiries.read'), ('supplier', 'customer_inquiries.create'), ('supplier', 'customer_inquiries.send'), ('supplier', 'customer_inquiries.upload'), ('supplier', 'customer_inquiries.submit'),
    ('supplier', 'customer_transactions.read'), ('supplier', 'customer_transactions.create'), ('supplier', 'customer_transactions.update'), ('supplier', 'customer_transactions.upload'), ('supplier', 'customer_transactions.cancel'), ('supplier', 'customer_transactions.print'),
    ('supplier', 'vehicle_requests.read'), ('supplier', 'vehicle_requests.submit'), ('supplier', 'vehicle_requests.cancel'),
    ('supplier', 'sell_vehicle.read'), ('supplier', 'sell_vehicle.submit'), ('supplier', 'sell_vehicle.cancel'),
    ('supplier', 'favourites.read'), ('supplier', 'favourites.create'), ('supplier', 'favourites.delete'),
    ('supplier', 'supplier_messages.read'), ('supplier', 'supplier_messages.send'),

    ('account_manager', 'finance.read'), ('account_manager', 'finance.create'), ('account_manager', 'finance.submit'),
    ('account_manager', 'inspections.read'), ('account_manager', 'inspections.print'),
    ('account_manager', 'inquiries.read'), ('account_manager', 'inquiries.send'), ('account_manager', 'inquiries.upload'), ('account_manager', 'inquiries.assign'), ('account_manager', 'inquiries.schedule'), ('account_manager', 'inquiries.handoff'), ('account_manager', 'inquiries.review'),
    ('account_manager', 'recommendations.read'),
    ('account_manager', 'transactions.read'), ('account_manager', 'transactions.review'), ('account_manager', 'transactions.cancel'), ('account_manager', 'transactions.start'), ('account_manager', 'transactions.upload'), ('account_manager', 'transactions.verify'), ('account_manager', 'transactions.waive'),
    ('account_manager', 'roadmap.read'),
    ('account_manager', 'suppliers.read'), ('account_manager', 'suppliers.create'), ('account_manager', 'suppliers.approve'), ('account_manager', 'suppliers.reject'), ('account_manager', 'suppliers.upload'), ('account_manager', 'suppliers.verify'),
    ('account_manager', 'staff_records.read'), ('account_manager', 'staff_records.update'), ('account_manager', 'staff_records.submit'), ('account_manager', 'staff_records.schedule'),
    ('account_manager', 'attendance.review'),
    ('account_manager', 'employee_requests.review'), ('account_manager', 'employee_requests.approve'), ('account_manager', 'employee_requests.reject'),
    ('account_manager', 'payroll.read'), ('account_manager', 'payroll.create'), ('account_manager', 'payroll.update'),
    ('account_manager', 'payslips.update'),
    ('account_manager', 'field_cases.read'),
    ('account_manager', 'reports.read'), ('account_manager', 'reports.submit'),
    ('account_manager', 'roles.read'), ('account_manager', 'roles.create'), ('account_manager', 'roles.update'), ('account_manager', 'roles.assign'),
    ('account_manager', 'users.read'), ('account_manager', 'users.create'),

    ('head_accountant', 'finance.read'), ('head_accountant', 'finance.create'), ('head_accountant', 'finance.verify'), ('head_accountant', 'finance.approve'), ('head_accountant', 'finance.reject'), ('head_accountant', 'finance.release'), ('head_accountant', 'finance.receive'), ('head_accountant', 'finance.mark_paid'),
    ('head_accountant', 'transactions.read'), ('head_accountant', 'transactions.complete'), ('head_accountant', 'transactions.record_payment'), ('head_accountant', 'transactions.verify'), ('head_accountant', 'transactions.approve'), ('head_accountant', 'transactions.waive'), ('head_accountant', 'transactions.instruct_repossession'),
    ('head_accountant', 'attendance.review'),
    ('head_accountant', 'payroll.read'),
    ('head_accountant', 'field_cases.read'), ('head_accountant', 'field_cases.create'),
    ('head_accountant', 'reports.read'), ('head_accountant', 'reports.submit'), ('head_accountant', 'reports.review'),
    ('head_accountant', 'suppliers.upload'),

    ('confidential_informant', 'finance.read'), ('confidential_informant', 'finance.submit'),
    ('confidential_informant', 'inspections.read'), ('confidential_informant', 'inspections.print'),
    ('confidential_informant', 'transactions.read'), ('confidential_informant', 'field_cases.read'),

    ('marketing_specialist', 'staff_showroom.read'),
    ('marketing_specialist', 'vehicles.create'), ('marketing_specialist', 'vehicles.update'), ('marketing_specialist', 'vehicles.publish'), ('marketing_specialist', 'vehicles.propose'), ('marketing_specialist', 'vehicles.upload'), ('marketing_specialist', 'vehicles.archive'),
    ('marketing_specialist', 'content.read'), ('marketing_specialist', 'content.create'), ('marketing_specialist', 'content.update'), ('marketing_specialist', 'content.delete'), ('marketing_specialist', 'content.publish'),
    ('marketing_specialist', 'recommendations.read'),

    ('mechanic', 'inspections.read'), ('mechanic', 'inspections.create'), ('mechanic', 'inspections.submit'), ('mechanic', 'inspections.print'), ('mechanic', 'field_cases.read'),

    ('sales_manager', 'staff_showroom.read'),
    ('sales_manager', 'inspections.read'), ('sales_manager', 'inspections.print'),
    ('sales_manager', 'inquiries.read'), ('sales_manager', 'inquiries.send'), ('sales_manager', 'inquiries.upload'), ('sales_manager', 'inquiries.assign'), ('sales_manager', 'inquiries.schedule'), ('sales_manager', 'inquiries.accept'),
    ('sales_manager', 'recommendations.read'),
    ('sales_manager', 'transactions.read'), ('sales_manager', 'transactions.review'), ('sales_manager', 'transactions.approve'), ('sales_manager', 'transactions.reject'), ('sales_manager', 'transactions.complete'), ('sales_manager', 'transactions.cancel'), ('sales_manager', 'transactions.upload'), ('sales_manager', 'transactions.verify'), ('sales_manager', 'transactions.assign'),
    ('sales_manager', 'roadmap.read'), ('sales_manager', 'staff_records.read'), ('sales_manager', 'users.create'),
    ('sales_manager', 'field_cases.read'), ('sales_manager', 'field_cases.create'), ('sales_manager', 'field_cases.update'), ('sales_manager', 'field_cases.assign'), ('sales_manager', 'field_cases.accept'), ('sales_manager', 'field_cases.start'), ('sales_manager', 'field_cases.complete'), ('sales_manager', 'field_cases.cancel'),

    ('head_security', 'security_duty_checks.read'), ('head_security', 'security_duty_checks.start'), ('head_security', 'security_duty_checks.upload'), ('head_security', 'security_duty_checks.complete')
)
INSERT INTO public.rbac_role_permissions (role_key, permission_id)
SELECT role_permissions.role_key, permissions.id
FROM role_permissions
JOIN new_roles ON new_roles.role_key = role_permissions.role_key
JOIN public.rbac_permissions AS permissions
  ON permissions.permission_key = role_permissions.permission_key
 AND permissions.status = 'active'
ON CONFLICT (role_key, permission_id) DO NOTHING;
