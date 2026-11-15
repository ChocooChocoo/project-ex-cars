-- T11 Phase 4: the Confidential Informant signs the sale papers handed to the buyer, so the handover row keeps
-- the CI's signature image next to the buyer's. The signature lives in the private transaction-documents bucket
-- and only the storage path is stored here.
-- signing_method gains 'in_app': the CI can sign on the device during the handover without the buyer's
-- e-signature flow running, which the old ('e_signature', 'face_to_face') check rejected.
-- transaction_documents gains a free-text note so staff can explain a rejected or replaced paper without
-- overloading the verification state.

BEGIN;

ALTER TABLE public.sale_handovers
  ADD COLUMN IF NOT EXISTS ci_signature_path TEXT;

ALTER TABLE public.sale_handovers
  DROP CONSTRAINT IF EXISTS sale_handovers_signing_method_check;

ALTER TABLE public.sale_handovers
  ADD CONSTRAINT sale_handovers_signing_method_check
  CHECK (signing_method IN ('e_signature', 'face_to_face', 'in_app'));

ALTER TABLE public.transaction_documents
  ADD COLUMN IF NOT EXISTS note TEXT;

COMMIT;
