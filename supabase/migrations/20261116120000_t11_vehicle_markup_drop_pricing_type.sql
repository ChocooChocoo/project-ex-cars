-- T11 Phase 3: financing markup moves from a single global rate to a per-car one. The Marketing Specialist can
-- set a markup on an individual car when the global rate does not fit it; the Financier's quote reads the car's
-- markup first.
-- NULL means "no per-car override": the global app_settings.financing_markup_pct applies as it did before.
-- pricing_type ('negotiable' / 'fixed') is dropped: every listed car is negotiated, and the column only fed a
-- badge on the showroom card that the new markup display replaces.

BEGIN;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS financing_markup_pct NUMERIC(5,2)
    CHECK (financing_markup_pct IS NULL OR financing_markup_pct BETWEEN 0 AND 100);

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_pricing_type_check;
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS pricing_type;

COMMIT;
