-- Fix: Grant authenticated access to read private.user_roles for RLS policy evaluation.
-- All RLS policies use SELECT 1 FROM private.user_roles WHERE ... to check staff roles.
-- RLS policies run as the authenticated user, which needs SELECT on private.user_roles
-- to evaluate the EXISTS check.

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT SELECT (account_id, role, active) ON private.user_roles TO authenticated;
