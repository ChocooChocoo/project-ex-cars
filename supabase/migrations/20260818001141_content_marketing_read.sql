-- Restore the Marketing Specialist's ability to read draft content items.
-- 00038 removed the broad management policy but did not add a replacement SELECT policy.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Marketing can read all content'
      AND tablename = 'content_items'
  ) THEN
    CREATE POLICY "Marketing can read all content"
      ON public.content_items FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM private.user_roles
          WHERE account_id = auth.uid()
            AND active = true
            AND role = 'marketing_specialist'
        )
      );
  END IF;
END $$;

DROP POLICY IF EXISTS "Marketing can update content" ON public.content_items;

CREATE POLICY "Marketing can update content"
  ON public.content_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM private.user_roles
      WHERE account_id = auth.uid()
        AND active = true
        AND role = 'marketing_specialist'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM private.user_roles
      WHERE account_id = auth.uid()
        AND active = true
        AND role = 'marketing_specialist'
    )
  );
