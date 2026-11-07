BEGIN;

-- T07 CR1: the Sales Manager now records cash installments (the Head Accountant only verifies them).
-- The T05 policy deliberately refused installment rows so only the Head Accountant could write them.
DROP POLICY IF EXISTS "Sales Manager can record buyer payments" ON public.payment_records;
CREATE POLICY "Sales Manager can record buyer payments" ON public.payment_records
  FOR INSERT TO authenticated
  WITH CHECK (
    recorded_by = auth.uid()
    AND verified_by IS NULL
    AND approved_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = payment_records.transaction_id AND t.transaction_kind = 'buy'
    )
    AND EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role = 'sales_manager'
    )
  );

COMMIT;
