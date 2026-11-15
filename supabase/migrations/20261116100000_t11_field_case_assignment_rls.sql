-- T11 Phase 1: the Confidential Informant and the Mechanic now work a field case from assignment to closing, so
-- their write access has to be limited to the cases they are actually assigned to. The 00042 UPDATE policy only
-- checked the role, which let any active field worker update any field case — including ones assigned to someone
-- else. This replaces it with an assignment-scoped policy and splits the staff read policy the same way: the
-- office roles (CEO, Sales Manager, Head Accountant) keep reading every case, while a field worker reads only the
-- cases assigned to them.
-- The assignment columns themselves stay server-written. Server actions assign and reassign with the service
-- role, so only browser sessions are blocked from moving a case onto themselves.
-- field_case_expenses needs no INSERT policy: it has none today, and every write to it goes through
-- createAdminClient() behind assignedCase(), which runs with the service role and therefore bypasses RLS.

BEGIN;

DROP POLICY IF EXISTS "Field workers can update field cases" ON public.field_cases;

CREATE POLICY "Field workers can update field cases"
  ON public.field_cases FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('confidential_informant', 'mechanic')
    )
    AND auth.uid() IN (assigned_confidential_informant, mechanic_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('confidential_informant', 'mechanic')
    )
    AND auth.uid() IN (assigned_confidential_informant, mechanic_id)
  );

DROP POLICY IF EXISTS "Staff can read field cases" ON public.field_cases;

CREATE POLICY "Staff can read field cases"
  ON public.field_cases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'head_accountant')
    )
    OR (
      EXISTS (
        SELECT 1 FROM private.user_roles
        WHERE account_id = auth.uid() AND active = true AND role = 'confidential_informant'
      )
      AND assigned_confidential_informant = auth.uid()
    )
    OR (
      EXISTS (
        SELECT 1 FROM private.user_roles
        WHERE account_id = auth.uid() AND active = true AND role = 'mechanic'
      )
      AND mechanic_id = auth.uid()
    )
  );

-- The worker UPDATE policy is scoped by assignment, but the assignment columns are the one thing a worker must
-- never change: moving a case to themselves would widen their own access. Server actions write the assignment
-- with the service role (current_user <> 'anon'/'authenticated'), so real assignments still land.
-- INSERT is deliberately not guarded: createFieldCase, openMeetupCase and the recovery inserts all create cases
-- from browser sessions and must keep working.
CREATE OR REPLACE FUNCTION public.guard_field_case_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND TG_OP = 'UPDATE' THEN
    NEW.assigned_confidential_informant := OLD.assigned_confidential_informant;
    NEW.head_security_id := OLD.head_security_id;
    NEW.case_kind := OLD.case_kind;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_field_case_assignment ON public.field_cases;
CREATE TRIGGER guard_field_case_assignment
  BEFORE UPDATE ON public.field_cases
  FOR EACH ROW EXECUTE FUNCTION public.guard_field_case_assignment();

COMMIT;
