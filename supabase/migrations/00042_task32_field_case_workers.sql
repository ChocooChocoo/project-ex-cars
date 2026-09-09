-- 00042: Task 32 — field-case worker write policies
-- The action guards already allow ceo/confidential_informant/mechanic/sales_manager
-- to update field cases and ceo/confidential_informant/sales_manager (+ head_accountant
-- for recovery, see 00038) to create them, but field_cases RLS write policies only
-- grant ceo/sales_manager (+ head_accountant INSERT). Add scoped worker policies so
-- the Confidential Informant and Mechanic can actually perform their documented
-- duties. Scoped EXISTS checks, no FOR ALL broadening, audit logging unchanged.

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Field workers can create field cases' AND tablename = 'field_cases') THEN
  CREATE POLICY "Field workers can create field cases"
    ON public.field_cases FOR INSERT
    WITH CHECK (EXISTS (
      SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true
      AND role IN ('confidential_informant', 'mechanic')
    ));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Field workers can update field cases' AND tablename = 'field_cases') THEN
  CREATE POLICY "Field workers can update field cases"
    ON public.field_cases FOR UPDATE
    USING (EXISTS (
      SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true
      AND role IN ('confidential_informant', 'mechanic')
    ));
END IF; END $$;
