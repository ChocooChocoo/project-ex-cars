-- 00025: Audit remediation — Head Accountant financial chain (G8, G10)
-- - notifications table (installment due-date alerts to Account Manager)
-- - disbursement_requests.purchase_transaction_id (CEO request → Head Accountant release)

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_role TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  reference_table TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_role, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON public.notifications(reference_table, reference_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipients may read notifications addressed to their current active role.
CREATE POLICY "Recipients can read own notifications" ON public.notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true AND role = recipient_role
    )
  );

-- Recipients may mark notifications read (no other update allowed).
CREATE POLICY "Recipients can mark notifications read" ON public.notifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true AND role = recipient_role
    )
  )
  WITH CHECK (is_read = true);

-- Link disbursements to car purchases so the release handoff is enforceable.
ALTER TABLE public.disbursement_requests
  ADD COLUMN IF NOT EXISTS purchase_transaction_id UUID REFERENCES public.transactions(id);
