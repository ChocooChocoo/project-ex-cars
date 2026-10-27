-- T03 HA2/HA3 (docs/implementation-plan/client-change-requests/phase-6.md).
-- Staff can attach a photo of the cheque or deposit slip when recording a payment, and the Head Accountant can
-- reject a payment with a reason instead of only verifying it. A rejected payment stays on record.

ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS proof_path text,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

DO $$ BEGIN
  ALTER TABLE public.payment_records
    ADD CONSTRAINT payment_records_verified_or_rejected
    CHECK (verified_by IS NULL OR rejected_at IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
