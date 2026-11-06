BEGIN;

CREATE TABLE public.reconditioning_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.reconditioning_jobs(id) ON DELETE CASCADE,
  part_name text NOT NULL CHECK (length(trim(part_name)) > 0),
  replacement_brand text NOT NULL,
  estimated_cost_cents bigint NOT NULL CHECK (estimated_cost_cents >= 0),
  actual_cost_cents bigint CHECK (actual_cost_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.reconditioning_fund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.reconditioning_jobs(id) ON DELETE CASCADE,
  disbursement_id uuid UNIQUE REFERENCES public.disbursement_requests(id),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  reason text NOT NULL,
  shortfall_reason text,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','submitted','approved','rejected','released')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.reconditioning_fund_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_request_id uuid NOT NULL REFERENCES public.reconditioning_fund_requests(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reconditioning_jobs
  ADD COLUMN refund_due_cents bigint NOT NULL DEFAULT 0 CHECK (refund_due_cents >= 0),
  ADD COLUMN refunded_at timestamptz;

ALTER TABLE public.reconditioning_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconditioning_fund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconditioning_fund_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vehicle staff read reconditioning parts" ON public.reconditioning_parts
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active
      AND role IN ('ceo','head_accountant','mechanic','sales_manager','marketing_specialist')
  ));
CREATE POLICY "Vehicle staff read reconditioning funds" ON public.reconditioning_fund_requests
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active
      AND role IN ('ceo','head_accountant','mechanic','sales_manager','marketing_specialist')
  ));
-- Receipts and all mechanic writes use guarded service-role actions, never direct client access.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reconditioning-receipts','reconditioning-receipts',false,10485760,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Assigned recovery team read cases" ON public.field_cases FOR SELECT TO authenticated
USING (case_kind = 'recovery' AND EXISTS (
  SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active AND (
    (role = 'head_security' AND head_security_id = auth.uid()) OR
    (role = 'confidential_informant' AND assigned_confidential_informant = auth.uid()) OR
    (role = 'mechanic' AND mechanic_id = auth.uid())
  )
));
CREATE POLICY "Assigned recovery team update cases" ON public.field_cases FOR UPDATE TO authenticated
USING (case_kind = 'recovery' AND EXISTS (
  SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active AND (
    (role = 'head_security' AND head_security_id = auth.uid()) OR
    (role = 'confidential_informant' AND assigned_confidential_informant = auth.uid()) OR
    (role = 'mechanic' AND mechanic_id = auth.uid())
  )
)) WITH CHECK (case_kind = 'recovery' AND auth.uid() IN (assigned_confidential_informant, head_security_id, mechanic_id));

-- Preserve old reports in the new ledger, without counting a legacy disbursement twice.
INSERT INTO public.reconditioning_fund_requests(job_id,disbursement_id,amount_cents,reason,state,created_by)
SELECT j.id,j.disbursement_id,d.amount_cents,'Legacy reconditioning fund',
  CASE WHEN d.status IN ('released','received','paid') THEN 'released' ELSE 'submitted' END,
  d.requested_by
FROM public.reconditioning_jobs j JOIN public.disbursement_requests d ON d.id=j.disbursement_id
WHERE d.amount_cents > 0 AND d.requested_by IS NOT NULL;

COMMIT;
