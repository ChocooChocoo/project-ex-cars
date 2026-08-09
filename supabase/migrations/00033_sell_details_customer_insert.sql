-- 00033: Allow customers to create sell_details for their own transactions
-- The RLS policies on sell_details only allowed SELECT for customers and ALL for
-- ceo/sales_manager, so the sell-vehicle submission failed with
-- "new row violates row-level security policy for table 'sell_details'".

CREATE POLICY "Customers can create own sell details"
  ON public.sell_details FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = sell_details.transaction_id
      AND customer_id = auth.uid()
    )
  );
