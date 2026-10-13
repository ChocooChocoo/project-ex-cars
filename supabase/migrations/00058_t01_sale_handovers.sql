-- 00058: T01 buying-flow revision, Phase 2 — vehicle papers custody (and the contract columns of Phase 3)
-- The Confidential Informant keeps a car's papers (OR/CR, Deed of Sale and related documents) until it
-- is sold. For a GCE visit the Sales Manager requests them and the CI hands them over; for a meet-up or
-- a delivery the CI releases them to himself, then hands them to the buyer.
-- One row per buy request. It is its own table, not columns on purchase_details, because customers can
-- update their own purchase_details and must never write custody or contract state.
-- Read-only under RLS; writes go through role-guarded server actions with the service role.

CREATE TABLE IF NOT EXISTS public.sale_handovers (
  transaction_id UUID PRIMARY KEY REFERENCES public.transactions(id) ON DELETE CASCADE,
  papers_status TEXT
    CHECK (papers_status IN ('requested', 'released_to_ci', 'handed_over', 'received', 'returned')),
  papers_ci_id UUID REFERENCES auth.users(id),
  papers_updated_at TIMESTAMPTZ,
  contract_body TEXT,
  contract_state TEXT
    CHECK (contract_state IN ('draft', 'pending_approval', 'returned', 'approved', 'signed')),
  contract_returned_reason TEXT,
  contract_written_by UUID REFERENCES auth.users(id),
  contract_approved_by UUID REFERENCES auth.users(id),
  contract_signed_at TIMESTAMPTZ,
  ci_copy_at TIMESTAMPTZ,
  mechanic_copy_at TIMESTAMPTZ,
  signing_reported_at TIMESTAMPTZ,
  buyer_met_at TIMESTAMPTZ,
  cash_reported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_handovers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Buyer and sales staff can read sale handovers' AND tablename = 'sale_handovers'
  ) THEN
    CREATE POLICY "Buyer and sales staff can read sale handovers"
      ON public.sale_handovers FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.transactions
          WHERE transactions.id = sale_handovers.transaction_id
            AND transactions.customer_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true
            AND role IN ('ceo', 'sales_manager', 'head_accountant', 'account_manager')
        )
      );
  END IF;
END $$;

-- The assigned Confidential Informant and Mechanic acknowledge a field case (used from Phase 4).
ALTER TABLE public.field_cases
  ADD COLUMN IF NOT EXISTS ci_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mechanic_received_at TIMESTAMPTZ;
