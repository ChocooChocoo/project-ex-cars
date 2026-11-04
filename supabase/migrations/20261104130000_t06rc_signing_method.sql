-- T06 reviewer changes: the buyer signs the purchase papers by e-signature in the app or face-to-face.
-- An e-signature keeps the drawn signature image in the private transaction-documents bucket.

ALTER TABLE public.sale_handovers
  ADD COLUMN IF NOT EXISTS signing_method TEXT CHECK (signing_method IN ('e_signature', 'face_to_face')),
  ADD COLUMN IF NOT EXISTS signature_path TEXT;
