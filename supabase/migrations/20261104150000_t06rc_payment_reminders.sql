-- T06 reviewer changes: GCE emails the buyer 7, 3 and 1 day before each financing installment is due. One row
-- per installment and window, so a rerun of the daily job never sends the same reminder twice.
-- Only the service role (the cron route) touches this table.

CREATE TABLE IF NOT EXISTS public.payment_reminders_sent (
  installment_id UUID NOT NULL REFERENCES public.installments (id) ON DELETE CASCADE,
  days_before INTEGER NOT NULL CHECK (days_before IN (7, 3, 1)),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installment_id, days_before)
);

ALTER TABLE public.payment_reminders_sent ENABLE ROW LEVEL SECURITY;
