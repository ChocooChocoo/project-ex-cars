-- T06 reviewer changes: the CEO approves a price from the vehicle view or requests a revision. The reason for a
-- revision goes back to the Marketing Specialist. `notes` already holds the proposer's own note, so the CEO's
-- reason gets its own column.

ALTER TABLE public.vehicle_price_proposals
  ADD COLUMN IF NOT EXISTS decision_notes TEXT;
