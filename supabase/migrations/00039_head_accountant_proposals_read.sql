-- 00039: Head Accountant read-only price proposals
-- Additive SELECT policy for head_accountant to view pending proposals.
-- Scoped EXISTS, not permissive, preserves RLS hardness.
-- Note: private.user_roles columns are account_id + active per 00001 schema; spec example uses user_id/is_active alias.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Head Accountant can read proposals'
    AND tablename = 'vehicle_price_proposals'
  ) THEN
    CREATE POLICY "Head Accountant can read proposals"
      ON public.vehicle_price_proposals
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = (select auth.uid())
          AND role = 'head_accountant'
          AND active = true
        )
      );
  END IF;
END $$;
