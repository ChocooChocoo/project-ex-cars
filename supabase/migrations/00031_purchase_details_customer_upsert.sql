-- 00031: Allow customers to create/update purchase_details for their own transactions
-- The RLS policies on purchase_details only allowed SELECT for customers and ALL for
-- ceo/sales_manager. Customers could not INSERT (the initial saveBuyDetails upsert) or
-- UPDATE (re-saving details), causing "new row violates row-level security policy".

CREATE POLICY "Customers can create own purchase details"
  ON public.purchase_details FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = purchase_details.transaction_id
      AND customer_id = auth.uid()
    )
  );

CREATE POLICY "Customers can update own purchase details"
  ON public.purchase_details FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = purchase_details.transaction_id
      AND customer_id = auth.uid()
    )
  );
