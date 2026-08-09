-- 00032: Allow customers to cancel (update) their own transactions and record status history
-- Customers could not UPDATE their own transactions (staff-only policy), so the
-- "Cancel Transaction" flow failed under RLS while still returning a success toast.
-- The status-history inserts (cancel, create buy/sell/request) also had no customer
-- INSERT policy, so those history rows silently never persisted.

CREATE POLICY "Customers can update own transactions"
  ON public.transactions FOR UPDATE
  USING (customer_id = auth.uid());

CREATE POLICY "Customers can record own status history"
  ON public.transaction_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = transaction_status_history.transaction_id
      AND customer_id = auth.uid()
    )
  );
