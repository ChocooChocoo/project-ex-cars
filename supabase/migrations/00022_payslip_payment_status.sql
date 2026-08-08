-- 00022: Phase 6 — Payslip salary-payment status (T-36)
-- Records the salary-payment responsibility handoff without moving money online.

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES public.profiles(id);
