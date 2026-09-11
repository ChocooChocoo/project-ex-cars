-- 00046: Task 33 corrective — field-case worker directory
--
-- private.user_roles is deliberately kept out of the exposed API schemas (see the
-- note above is_active_mechanic in /migrations/20260818032217_task28_security_data.sql),
-- so neither page that needs the worker directory could read role assignments
-- through PostgREST:
--   * field-cases/page.tsx called get_all_user_roles(), which raises
--     'Permission denied: only CEO or Account Manager can list all roles' for every
--     other role, leaving the Create Field Case "Assigned Worker" dropdown empty.
--   * transactions/[id]/page.tsx embedded profiles -> private_user_roles!inner, but no
--     such foreign key exists, so PostgREST answered PGRST200 and the repossession
--     informant list was empty for every role.
-- An empty Radix Select still opens a modal layer that sets pointer-events: none on the
-- rest of the page, so the user's next click landed on the dialog overlay and dismissed
-- the Create Field Case dialog.
--
-- Expose exactly the worker directory those two screens need: active Confidential
-- Informants and Mechanics, by name, to the roles that may assign them.

CREATE OR REPLACE FUNCTION public.list_field_case_workers()
RETURNS TABLE (account_id UUID, role TEXT, full_name TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT worker.account_id, worker.role, profile.full_name
  FROM private.user_roles AS worker
  JOIN public.profiles AS profile ON profile.id = worker.account_id
  WHERE worker.active = true
    AND worker.role IN ('confidential_informant', 'mechanic')
    AND EXISTS (
      SELECT 1
      FROM private.user_roles AS actor
      WHERE actor.account_id = auth.uid()
        AND actor.active = true
        AND actor.role IN (
          'ceo',
          'account_manager',
          'sales_manager',
          'head_accountant',
          'confidential_informant',
          'mechanic'
        )
    )
  ORDER BY profile.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_field_case_workers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_field_case_workers() TO authenticated;
