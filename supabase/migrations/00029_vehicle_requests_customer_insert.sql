-- 00029: Allow customers to create vehicle_requests for their own transactions (bug fix)
-- Previously the only INSERT-capable policy on vehicle_requests was "Staff can manage
-- requests" (ceo/sales_manager), so the request-a-car submission failed with
-- "new row violates row-level security policy for table 'vehicle_requests'".

CREATE POLICY "Customers can create own requests"
  ON public.vehicle_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = vehicle_requests.transaction_id
      AND customer_id = auth.uid()
    )
  );
