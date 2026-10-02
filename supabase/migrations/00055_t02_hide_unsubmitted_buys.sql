-- 00055: T02 client feedback
-- 1. Buy Now creates a pending buy row before the buyer has filled anything in. Staff must not
--    see it until the buyer clicks Submit Request (submitBuyRequest sets flow_status, or
--    queue_state for a request put On Hold). Walk-ins created by staff stay visible.
-- 2. Files now upload straight from the browser to storage (Vercel caps a function request
--    at 4.5 MB), so the 5 MB per-file rule is enforced on the bucket itself.

DROP POLICY IF EXISTS "Staff can read all transactions" ON public.transactions;

CREATE POLICY "Staff can read all transactions"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'account_manager', 'head_accountant', 'confidential_informant')
    )
    AND NOT (
      transaction_kind = 'buy'
      AND current_state = 'pending'
      AND flow_status IS NULL
      AND queue_state IS NULL
      AND created_by = customer_id
    )
  );

UPDATE storage.buckets SET file_size_limit = 5242880 WHERE id = 'transaction-documents';
