-- 00057: T01 buying-flow revision, Phase 1.
-- The Sales Manager (or the Marketing Specialist, for a seller's papers) can ask for an image to be
-- resubmitted and say what to fix. The reason is shown to the uploader beside the rejected document.

ALTER TABLE public.transaction_documents
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
