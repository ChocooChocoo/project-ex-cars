-- 00030: Allow sales managers to self-assign inquiries (bug fix)
-- The previous UPDATE policy only allowed staff to update inquiries already assigned
-- to them, plus any ceo/account_manager. A sales manager clicking "Assign to Me" on an
-- unassigned buy_now inquiry was blocked by RLS, so the button appeared to do nothing.

DROP POLICY "Staff can update assigned inquiries" ON public.inquiries;

CREATE POLICY "Staff can update assigned inquiries"
  ON public.inquiries FOR UPDATE
  USING (
    (assigned_account_manager = auth.uid() OR assigned_sales_manager = auth.uid())
    OR EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'sales_manager')
    )
  );
