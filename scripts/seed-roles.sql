-- Assign correct roles to GCE seed users.
-- Run after scripts/seed-users.cjs which creates users with default "customer" role.
--
-- Usage:
--   npx supabase db query --linked --file scripts/seed-roles.sql

UPDATE private.user_roles ur
SET role = roles.target_role, assigned_at = now()
FROM auth.users au
JOIN (
  VALUES
    ('customer@gce.local', 'customer'),
    ('supplier@gce.local', 'supplier'),
    ('ceo@gce.local', 'ceo'),
    ('account_manager@gce.local', 'account_manager'),
    ('head_accountant@gce.local', 'head_accountant'),
    ('confidential_informant@gce.local', 'confidential_informant'),
    ('marketing_specialist@gce.local', 'marketing_specialist'),
    ('mechanic@gce.local', 'mechanic'),
    ('sales_manager@gce.local', 'sales_manager'),
    ('head_security@gce.local', 'head_security')
) AS roles(email, target_role) ON au.email = roles.email
WHERE ur.account_id = au.id AND ur.active = true;
