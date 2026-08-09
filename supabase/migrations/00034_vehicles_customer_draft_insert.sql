-- 00034: Allow customers to create draft vehicles for their sell transactions
-- submitSellVehicle creates a draft vehicle listing linked to the sell transaction,
-- which failed with "new row violates row-level security policy for table 'vehicles'".
-- Restricted to listing_state = 'draft' so customers cannot publish vehicles
-- (public listings are staff-approved via the marketing/CEO workflows).

CREATE POLICY "Customers can create draft vehicles"
  ON public.vehicles FOR INSERT
  WITH CHECK (listing_state = 'draft');
