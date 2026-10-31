-- T05 Phase 9 (client change requests batch 3): the Deed of Sale prints the car's plate, engine and
-- chassis numbers next to the VIN. `vehicles.vin` alone cannot fill that line, so the three identifiers
-- get their own nullable columns. Cars recorded before this migration keep them NULL and the printed
-- deed shows a blank line for each.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS plate_number TEXT,
  ADD COLUMN IF NOT EXISTS engine_number TEXT,
  ADD COLUMN IF NOT EXISTS chassis_number TEXT;
