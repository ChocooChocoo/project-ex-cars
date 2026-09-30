-- 00054: T01 Phase 5 — In-House Financing: GCE Visit (GCE Process Flows §6, "For Client Validation")
-- Built on the team's defaults until the client signs off §6 (Q4 7-day window, Q5 flag on the first
-- missed installment and repossession from the 4th, Q6 the Head Accountant reviews, not co-calculates).
-- - payment_terms: payment duration, Head Accountant review and CEO confirmation, returned-for-revision.
-- - installment_accounts: missed-payment flag and a repossessed state.
-- - reconditioning_jobs: the recovered car's status report, fund request, final report, papers and
--   repricing hand-off (§6 steps 27–38). Writes go through role-guarded server actions.

-- ============================================================
-- 1. Financing terms approval chain
-- ============================================================
ALTER TABLE public.payment_terms
  ADD COLUMN IF NOT EXISTS duration_months INTEGER CHECK (duration_months >= 1),
  ADD COLUMN IF NOT EXISTS ha_reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS ha_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_reason TEXT;

DO $$ BEGIN
  ALTER TABLE public.payment_terms DROP CONSTRAINT IF EXISTS payment_terms_state_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.payment_terms
  ADD CONSTRAINT payment_terms_state_check
  CHECK (state IN ('proposed', 'ha_approved', 'returned', 'approved', 'rejected', 'active', 'completed'));

-- ============================================================
-- 2. Installment account: missed payment flag, repossession
-- ============================================================
ALTER TABLE public.installment_accounts
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.installment_accounts DROP CONSTRAINT IF EXISTS installment_accounts_state_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.installment_accounts
  ADD CONSTRAINT installment_accounts_state_check
  CHECK (state IN ('active', 'closed', 'repossessed'));

-- ============================================================
-- 3. Reconditioning after repossession
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reconditioning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id),
  state TEXT NOT NULL DEFAULT 'awaiting_report'
    CHECK (state IN ('awaiting_report', 'awaiting_funds', 'in_progress', 'completed')),
  status_report TEXT,
  required_parts TEXT,
  estimated_cost NUMERIC(12,2) CHECK (estimated_cost >= 0),
  disbursement_id UUID REFERENCES public.disbursement_requests(id),
  final_report TEXT,
  actual_cost NUMERIC(12,2) CHECK (actual_cost >= 0),
  mechanic_id UUID REFERENCES auth.users(id),
  papers_processed_at TIMESTAMPTZ,
  papers_processed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One open job per car.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reconditioning_jobs_open
  ON public.reconditioning_jobs(vehicle_id)
  WHERE state <> 'completed';

ALTER TABLE public.reconditioning_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Vehicle staff can read reconditioning jobs' AND tablename = 'reconditioning_jobs'
  ) THEN
    CREATE POLICY "Vehicle staff can read reconditioning jobs"
      ON public.reconditioning_jobs FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true
            AND role IN ('ceo', 'head_accountant', 'mechanic', 'sales_manager', 'marketing_specialist')
        )
      );
  END IF;
END $$;
