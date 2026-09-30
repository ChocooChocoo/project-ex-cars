-- 00049: T01 Phase 1 — Selling Scenario (GCE Process Flows §1)
-- The Marketing Specialist now owns the sell offer (Q0b): verifies the papers, proposes the purchase
-- ceiling to the CEO, negotiates in the website chat, and files the Inspection Issue Report.
-- Writes for the new steps go through role-guarded server actions (service role), so this migration
-- adds columns, two tables, and read access only. The only write policies added are the customer's
-- own sell papers and the customer's own negotiation thread.

-- ============================================================
-- 1. sell_details: intake declarations, agreed price, payment clearance
-- ============================================================
ALTER TABLE public.sell_details
  ADD COLUMN IF NOT EXISTS has_known_issues BOOLEAN,
  ADD COLUMN IF NOT EXISTS declared_issues TEXT,
  ADD COLUMN IF NOT EXISTS meetup_method TEXT CHECK (meetup_method IN ('meet_halfway', 'gce_visit')),
  ADD COLUMN IF NOT EXISTS agreed_price NUMERIC(12,2) CHECK (agreed_price >= 0),
  ADD COLUMN IF NOT EXISTS cleared_for_payment_at TIMESTAMPTZ;

-- ============================================================
-- 2. vehicle_price_proposals: proposal kind + transaction link
-- ============================================================
ALTER TABLE public.vehicle_price_proposals
  ADD COLUMN IF NOT EXISTS proposal_kind TEXT NOT NULL DEFAULT 'selling_price'
    CHECK (proposal_kind IN ('purchase_ceiling', 'revised_ceiling', 'selling_price', 'reprice')),
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE;

-- Ceilings belong to a sell transaction; listing prices never do.
DO $$ BEGIN
  ALTER TABLE public.vehicle_price_proposals
    ADD CONSTRAINT vehicle_price_proposals_ceiling_transaction_check
    CHECK ((proposal_kind IN ('purchase_ceiling', 'revised_ceiling')) = (transaction_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_proposals_one_pending_per_kind
  ON public.vehicle_price_proposals(vehicle_id, proposal_kind)
  WHERE decision = 'pending';

CREATE INDEX IF NOT EXISTS idx_price_proposals_transaction
  ON public.vehicle_price_proposals(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ============================================================
-- 3. inquiries: sell negotiation thread linked to its transaction
-- ============================================================
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE;

DO $$ BEGIN
  ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_intention_kind_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_intention_kind_check
  CHECK (intention_kind IN ('inquiry', 'buy_now', 'sell_negotiation'));

DO $$ BEGIN
  ALTER TABLE public.inquiries
    ADD CONSTRAINT inquiries_sell_negotiation_transaction_check
    CHECK ((intention_kind = 'sell_negotiation') = (transaction_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiries_transaction
  ON public.inquiries(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- The 00005 insert policy only checked customer_id, so a customer could link a thread to someone
-- else's transaction. A negotiation thread must point at the customer's own sell transaction.
DROP POLICY IF EXISTS "Customers can create inquiries" ON public.inquiries;

CREATE POLICY "Customers can create inquiries"
  ON public.inquiries FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND (
      transaction_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.transactions
        WHERE transactions.id = inquiries.transaction_id
          AND transactions.customer_id = auth.uid()
          AND transactions.transaction_kind = 'sell'
      )
    )
  );

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Marketing Specialist can read sell negotiations' AND tablename = 'inquiries'
  ) THEN
    CREATE POLICY "Marketing Specialist can read sell negotiations"
      ON public.inquiries FOR SELECT
      TO authenticated
      USING (
        intention_kind = 'sell_negotiation'
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Marketing Specialist can read sell negotiation messages' AND tablename = 'inquiry_messages'
  ) THEN
    CREATE POLICY "Marketing Specialist can read sell negotiation messages"
      ON public.inquiry_messages FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.inquiries
          WHERE inquiries.id = inquiry_messages.inquiry_id
            AND inquiries.intention_kind = 'sell_negotiation'
        )
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Marketing Specialist can send sell negotiation messages' AND tablename = 'inquiry_messages'
  ) THEN
    CREATE POLICY "Marketing Specialist can send sell negotiation messages"
      ON public.inquiry_messages FOR INSERT
      TO authenticated
      WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.inquiries
          WHERE inquiries.id = inquiry_messages.inquiry_id
            AND inquiries.intention_kind = 'sell_negotiation'
        )
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'
        )
      );
  END IF;
END $$;

-- ============================================================
-- 4. Marketing Specialist read access to sell transactions
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Marketing Specialist can read sell transactions' AND tablename = 'transactions'
  ) THEN
    CREATE POLICY "Marketing Specialist can read sell transactions"
      ON public.transactions FOR SELECT
      TO authenticated
      USING (
        transaction_kind = 'sell'
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Marketing Specialist can read sell status history' AND tablename = 'transaction_status_history'
  ) THEN
    CREATE POLICY "Marketing Specialist can read sell status history"
      ON public.transaction_status_history FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.transactions
          WHERE transactions.id = transaction_status_history.transaction_id
            AND transactions.transaction_kind = 'sell'
        )
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Marketing Specialist can read sell details' AND tablename = 'sell_details'
  ) THEN
    CREATE POLICY "Marketing Specialist can read sell details"
      ON public.sell_details FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Marketing Specialist can read sell documents' AND tablename = 'transaction_documents'
  ) THEN
    CREATE POLICY "Marketing Specialist can read sell documents"
      ON public.transaction_documents FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.transactions
          WHERE transactions.id = transaction_documents.transaction_id
            AND transactions.transaction_kind = 'sell'
        )
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Marketing Specialist can read sell document files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Marketing Specialist can read sell document files"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'transaction-documents'
        AND EXISTS (
          SELECT 1 FROM public.transactions
          WHERE transactions.id = (storage.foldername(name))[1]::uuid
            AND transactions.transaction_kind = 'sell'
        )
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Marketing Specialist can read acquisition field cases' AND tablename = 'field_cases'
  ) THEN
    CREATE POLICY "Marketing Specialist can read acquisition field cases"
      ON public.field_cases FOR SELECT
      TO authenticated
      USING (
        case_kind = 'acquisition'
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'
        )
      );
  END IF;
END $$;

-- ============================================================
-- 5. Customer sell papers: 2 IDs, ORCR, deed of sale — always pending
-- ============================================================
DROP POLICY IF EXISTS "Customers can upload own sell papers" ON public.transaction_documents;

CREATE POLICY "Customers can upload own sell papers"
  ON public.transaction_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND document_kind IN ('valid_id', 'orcr', 'deed_of_sale')
    AND verification_state = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE transactions.id = transaction_documents.transaction_id
        AND transactions.customer_id = auth.uid()
        AND transactions.transaction_kind = 'sell'
    )
    AND (
      storage_path IS NULL
      OR storage_path LIKE transaction_documents.transaction_id::text || '/%'
    )
  );

-- ============================================================
-- 6. field_cases: identity / plate checks and inspection outcome
-- ============================================================
ALTER TABLE public.field_cases
  ADD COLUMN IF NOT EXISTS identity_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_confirmed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS plate_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plate_confirmed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS inspection_outcome TEXT CHECK (inspection_outcome IN ('no_issues', 'issue_found')),
  ADD COLUMN IF NOT EXISTS issue_description TEXT,
  ADD COLUMN IF NOT EXISTS repair_estimate NUMERIC(12,2) CHECK (repair_estimate >= 0),
  ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ;

-- ============================================================
-- 7. inspection_issue_reports (Selling step 7)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inspection_issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  field_case_id UUID NOT NULL UNIQUE REFERENCES public.field_cases(id) ON DELETE CASCADE,
  issue_found TEXT NOT NULL,
  repair_estimate NUMERIC(12,2) NOT NULL CHECK (repair_estimate >= 0),
  is_profitable BOOLEAN NOT NULL,
  profitability_reason TEXT NOT NULL,
  recalculated_price NUMERIC(12,2) CHECK (recalculated_price >= 0),
  new_ceiling NUMERIC(12,2) CHECK (new_ceiling >= 0),
  proposal_id UUID REFERENCES public.vehicle_price_proposals(id),
  seller_response TEXT CHECK (seller_response IN ('agreed', 'refused')),
  seller_response_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT is_profitable OR (recalculated_price IS NOT NULL AND new_ceiling IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_transaction ON public.inspection_issue_reports(transaction_id);

ALTER TABLE public.inspection_issue_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Marketing Specialist and CEO can read issue reports' AND tablename = 'inspection_issue_reports'
  ) THEN
    CREATE POLICY "Marketing Specialist and CEO can read issue reports"
      ON public.inspection_issue_reports FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role IN ('marketing_specialist', 'ceo')
        )
      );
  END IF;
END $$;

-- ============================================================
-- 8. field_case_expenses (Selling steps 11–13)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.field_case_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_case_id UUID NOT NULL REFERENCES public.field_cases(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL,
  proof_document_id UUID NOT NULL REFERENCES public.transaction_documents(id),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reimbursed_at TIMESTAMPTZ,
  reimbursed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_field_case_expenses_case ON public.field_case_expenses(field_case_id);
CREATE INDEX IF NOT EXISTS idx_field_case_expenses_unreimbursed
  ON public.field_case_expenses(field_case_id)
  WHERE reimbursed_at IS NULL;

ALTER TABLE public.field_case_expenses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Submitters and finance can read field expenses' AND tablename = 'field_case_expenses'
  ) THEN
    CREATE POLICY "Submitters and finance can read field expenses"
      ON public.field_case_expenses FOR SELECT
      TO authenticated
      USING (
        submitted_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true
            AND role IN ('ceo', 'head_accountant', 'marketing_specialist')
        )
      );
  END IF;
END $$;

-- ============================================================
-- 9. Worker directory: the Marketing Specialist assigns the field team on agreement
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_field_case_workers()
RETURNS TABLE (account_id UUID, role TEXT, full_name TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT worker.account_id, worker.role, profile.full_name
  FROM private.user_roles AS worker
  JOIN public.profiles AS profile ON profile.id = worker.account_id
  WHERE worker.active = true
    AND worker.role IN ('confidential_informant', 'mechanic')
    AND EXISTS (
      SELECT 1
      FROM private.user_roles AS actor
      WHERE actor.account_id = auth.uid()
        AND actor.active = true
        AND actor.role IN (
          'ceo',
          'account_manager',
          'sales_manager',
          'head_accountant',
          'confidential_informant',
          'mechanic',
          'marketing_specialist'
        )
    )
  ORDER BY profile.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_field_case_workers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_field_case_workers() TO authenticated;
