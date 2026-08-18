-- Task 28: CEO workflow security and data-access fixes.

-- Staff may upload documents into an existing transaction folder.  Keep the
-- bucket and transaction guards so this does not become a general-purpose
-- storage upload policy.
CREATE POLICY "Staff can upload transaction documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'transaction-documents'
    AND EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE transactions.id = (storage.foldername(name))[1]::uuid
    )
    AND EXISTS (
      SELECT 1
      FROM private.user_roles
      WHERE account_id = auth.uid()
        AND active = true
        AND role IN ('ceo', 'sales_manager', 'account_manager')
    )
  );

-- The document row is inserted immediately after the storage upload. Keep
-- account-manager coverage scoped to INSERT; existing staff manage policies
-- remain unchanged for updates and deletes.
CREATE POLICY "Staff can upload transaction document records"
  ON public.transaction_documents
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1
    FROM private.user_roles
    WHERE account_id = auth.uid()
      AND active = true
      AND role IN ('ceo', 'sales_manager', 'account_manager')
  ));

-- The role table is deliberately kept out of the exposed API schemas. Expose
-- only the mechanic check needed by the field-case action through a guarded
-- SECURITY DEFINER function; callers still have to be authorized field staff.
CREATE OR REPLACE FUNCTION public.is_active_mechanic(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.user_roles target_role
    WHERE target_role.account_id = p_account_id
      AND target_role.role = 'mechanic'
      AND target_role.active = true
  )
  AND EXISTS (
    SELECT 1
    FROM private.user_roles actor_role
    WHERE actor_role.account_id = auth.uid()
      AND actor_role.active = true
      AND actor_role.role IN ('ceo', 'confidential_informant', 'sales_manager')
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_mechanic(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_mechanic(UUID) TO authenticated;

-- CEO and Head Accountant may review reports.  Both clauses are intentional:
-- USING authorizes the existing row and WITH CHECK protects the new row.
CREATE POLICY "CEO and Head Accountant can review reports"
  ON public.reports
  FOR UPDATE
  USING (EXISTS (
    SELECT 1
    FROM private.user_roles
    WHERE account_id = auth.uid()
      AND active = true
      AND role IN ('ceo', 'head_accountant')
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM private.user_roles
    WHERE account_id = auth.uid()
      AND active = true
      AND role IN ('ceo', 'head_accountant')
  ));
