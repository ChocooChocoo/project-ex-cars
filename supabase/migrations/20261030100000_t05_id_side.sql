-- T05 Phase 2 (client change requests batch 3): the buyer sends the front and the back of two valid IDs,
-- so each ID upload records which side it shows. Rows uploaded before this migration keep a null side and
-- stay on the old two-ID rule.

ALTER TABLE public.transaction_documents
  ADD COLUMN IF NOT EXISTS id_side TEXT CHECK (id_side IN ('front', 'back'));
