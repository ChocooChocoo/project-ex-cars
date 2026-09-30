-- 00053: T01 — staff can read the arrangement of a buy request
-- Buy requests (§2–4) book their GCE visit, meet-up or delivery in viewing_arrangements with
-- purchase_transaction_id and no inquiry. 00005/00038 only let staff read an arrangement through an
-- inquiry they are assigned to, so the Sales Manager, who reviews and closes these requests, could not
-- see the booked time, the meet-up kind or the delivery address. Read-only; writes stay with the
-- role-guarded server actions.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Sales staff can read buy request arrangements' AND tablename = 'viewing_arrangements'
  ) THEN
    CREATE POLICY "Sales staff can read buy request arrangements"
      ON public.viewing_arrangements FOR SELECT
      TO authenticated
      USING (
        purchase_transaction_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.transactions
          WHERE transactions.id = viewing_arrangements.purchase_transaction_id
            AND transactions.transaction_kind = 'buy'
        )
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true
            AND role IN ('sales_manager', 'head_accountant')
        )
      );
  END IF;
END $$;
