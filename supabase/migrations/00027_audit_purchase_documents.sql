-- 00027: Audit remediation — two valid IDs + proof of billing (G16)
-- Track the ID type submitted per transaction document and gate purchase completion on verification.

ALTER TABLE public.transaction_documents
  ADD COLUMN IF NOT EXISTS id_type TEXT;
