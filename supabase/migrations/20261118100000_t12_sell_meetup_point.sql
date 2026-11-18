-- T12: the Meet Halfway point a seller sets on the map. The app suggests the straight-line midpoint between
-- GCE and the seller's device location; the seller may drag the pin. Null for a GCE Visit.
ALTER TABLE public.sell_details
  ADD COLUMN IF NOT EXISTS meetup_lat NUMERIC(9, 6) CHECK (meetup_lat BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS meetup_lng NUMERIC(9, 6) CHECK (meetup_lng BETWEEN -180 AND 180);
