-- 00016: Phase 6 — Finance, Disbursements, Reports, and Announcements
-- Monetary values use integer minor units (centavos) for exact decimal arithmetic.

-- Financial entries: general ledger records linked to transactions or field cases
CREATE TABLE IF NOT EXISTS public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_kind TEXT NOT NULL CHECK (entry_kind IN ('revenue', 'expense', 'disbursement', 'adjustment')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  field_case_id UUID REFERENCES public.field_cases(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read financial entries" ON public.financial_entries
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'head_accountant', 'account_manager', 'sales_manager')
  ));

CREATE POLICY "Account Manager and Head Accountant can insert entries" ON public.financial_entries
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'head_accountant', 'account_manager')
  ));

CREATE POLICY "Head Accountant and CEO can verify entries" ON public.financial_entries
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'head_accountant')
  ));

-- Disbursement requests: fund handoffs with approval chain
CREATE TABLE IF NOT EXISTS public.disbursement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'released', 'received', 'paid')),
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  released_by UUID REFERENCES public.profiles(id),
  received_by UUID REFERENCES public.profiles(id),
  evidence_storage_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.disbursement_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester and approvers can read own" ON public.disbursement_requests
  FOR SELECT USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
      AND active = true AND role IN ('ceo', 'head_accountant', 'account_manager')
    )
  );

CREATE POLICY "Account Manager and Confidential Informant can create" ON public.disbursement_requests
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager', 'confidential_informant')
  ));

CREATE POLICY "CEO and Head Accountant can update for approval/release" ON public.disbursement_requests
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'head_accountant')
  ));

-- Disbursement events: immutable audit trail
CREATE TABLE IF NOT EXISTS public.disbursement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disbursement_id UUID NOT NULL REFERENCES public.disbursement_requests(id) ON DELETE CASCADE,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('submitted', 'approved', 'rejected', 'released', 'received', 'paid')),
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.disbursement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Same access as parent disbursement" ON public.disbursement_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.disbursement_requests dr
    WHERE dr.id = disbursement_id
    AND (dr.requested_by = auth.uid() OR EXISTS (
      SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
      AND active = true AND role IN ('ceo', 'head_accountant', 'account_manager')
    ))
  ));

CREATE POLICY "Authorized roles can insert events" ON public.disbursement_events
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'head_accountant', 'account_manager')
  ));

-- Reports: submitted documents with evidence files
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_kind TEXT NOT NULL CHECK (report_kind IN ('attendance', 'payroll', 'disbursement', 'expense', 'revenue', 'inventory', 'sales', 'management', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  evidence_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'archived')),
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO and Head Accountant can read all reports" ON public.reports
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'head_accountant')
  ));

CREATE POLICY "Submitters can read own reports" ON public.reports
  FOR SELECT USING (submitted_by = auth.uid());

CREATE POLICY "Account Manager, CEO, and Head Accountant can create reports" ON public.reports
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'head_accountant', 'account_manager')
  ));

-- Announcements: CEO drafts/publishes, employees read active
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'expired', 'archived')),
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read published announcements" ON public.announcements
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND status = 'published'
    AND (expires_at IS NULL OR expires_at > now())
  );

CREATE POLICY "CEO can read all announcements" ON public.announcements
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role = 'ceo'
  ));

CREATE POLICY "CEO can manage announcements" ON public.announcements
  FOR ALL USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role = 'ceo'
  ));
