ALTER TABLE public.purchase_details
  ADD COLUMN location TEXT,
  ADD COLUMN cancellation_towing_ack_at TIMESTAMPTZ,
  ADD COLUMN cancellation_towing_ack_by UUID REFERENCES auth.users(id);

-- Preserve existing addresses before enforcing the new-write constraint.
UPDATE public.purchase_details p SET location = a.location
FROM (SELECT DISTINCT ON (purchase_transaction_id) purchase_transaction_id, location
      FROM public.viewing_arrangements WHERE nullif(btrim(location), '') IS NOT NULL
      ORDER BY purchase_transaction_id, created_at DESC) a
WHERE a.purchase_transaction_id = p.transaction_id;

ALTER TABLE public.purchase_details ADD CONSTRAINT purchase_details_location_required
  CHECK (arrangement_kind NOT IN ('meetup', 'delivery') OR nullif(btrim(location), '') IS NOT NULL) NOT VALID;
ALTER TABLE public.viewing_arrangements ADD CONSTRAINT viewing_arrangements_location_required
  CHECK (confirmation_state = 'cancelled' OR arrangement_kind NOT IN ('meetup', 'delivery')
    OR nullif(btrim(location), '') IS NOT NULL) NOT VALID;
