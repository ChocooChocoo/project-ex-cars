-- 00018: Phase 6 — Field Operations (extend field_cases, security duty checks)

-- Add expense tracking to field_cases
ALTER TABLE public.field_cases ADD COLUMN IF NOT EXISTS expenses_cents BIGINT DEFAULT 0 CHECK (expenses_cents >= 0);
ALTER TABLE public.field_cases ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.field_cases ADD COLUMN IF NOT EXISTS notes TEXT;

-- Security duty checks: Head Security before/after evidence
CREATE TABLE IF NOT EXISTS public.security_duty_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duty_date DATE NOT NULL DEFAULT CURRENT_DATE,
  before_image_path TEXT,
  after_image_path TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_security_duty_date UNIQUE (security_id, duty_date)
);

ALTER TABLE public.security_duty_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Head Security can manage own duty checks" ON public.security_duty_checks
  FOR ALL USING (security_id = auth.uid());

CREATE POLICY "CEO can read all duty checks" ON public.security_duty_checks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role = 'ceo'
  ));

CREATE POLICY "Head Security role can read own duty checks" ON public.security_duty_checks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'head_security')
    AND security_id = auth.uid()
  ));
