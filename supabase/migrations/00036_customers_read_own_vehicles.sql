-- 00036: Allow customers to read vehicles linked to their own transactions
-- submitSellVehicle inserts a draft vehicle and links it to the sell transaction;
-- the my-transactions pages join vehicles via transactions.vehicle_id, but no
-- SELECT policy allowed customers to read draft vehicles (the public SELECT
-- policy only covers available/reserved/sold, staff policies require staff roles).

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can read own vehicles' AND tablename = 'vehicles') THEN
  CREATE POLICY "Customers can read own vehicles"
    ON public.vehicles FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.transactions
        WHERE transactions.vehicle_id = vehicles.id
        AND transactions.customer_id = auth.uid()
      )
    );
END IF; END $$;
