-- 00048: T01 Phase 0 — process-flow foundations
-- Additive groundwork for the GCE Process Flows phases (docs/plans/2026-09-29-t01-process-flows-implementation.md).
-- - transactions.flow_status / flag / review_due_at: process-doc labels (Appendix B) beside the coarse
--   current_state. Overdue is derived on read from review_due_at; nothing auto-cancels.
-- - notifications.recipient_id: per-user notifications. A row targets exactly one role OR one user,
--   so a buyer-addressed row is never readable by every account holding the customer role.
-- - transaction_documents.document_kind += orcr, deed_of_sale, inspection_photo, expense_proof.
--   Only the kind check widens; no document policy changes.
-- - purchase_details.payment_method += bank_transfer (D5). down_payment stays valid for old rows.
-- - customer_standing: no-shows and strikes live outside profiles, because customers can UPDATE their
--   own profiles row (00001) and would otherwise be able to reset them (D4).

-- ============================================================
-- 1. transactions: flow status, flag, review window
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS flow_status TEXT
    CHECK (flow_status IN (
      'pending_ceo_approval',
      'pending_sm_approval',
      'approved_awaiting_buyer_decision',
      'gce_visit_scheduled_dp_pending',
      'purchase_claim',
      'potential_buyer',
      'initial_dp_awaiting_verification',
      'initial_dp_confirmed',
      'financing_active',
      'financing_completed',
      'repossessed',
      'sold'
    )),
  ADD COLUMN IF NOT EXISTS flag TEXT
    CHECK (flag IN (
      'declined_by_buyer',
      'buyer_no_show',
      'buyer_unavailable',
      'flagged',
      'cancelled_unprofitable',
      'seller_refused'
    )),
  ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_transactions_review_due_at
  ON public.transactions(review_due_at)
  WHERE review_due_at IS NOT NULL;

-- ============================================================
-- 2. notifications: per-user recipient
-- ============================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ALTER COLUMN recipient_role DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_single_recipient_check
    CHECK ((recipient_role IS NULL) <> (recipient_id IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id
  ON public.notifications(recipient_id, is_read)
  WHERE recipient_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can read own user notifications'
      AND tablename = 'notifications'
  ) THEN
    CREATE POLICY "Users can read own user notifications"
      ON public.notifications
      FOR SELECT
      TO authenticated
      USING (recipient_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can mark own user notifications read'
      AND tablename = 'notifications'
  ) THEN
    CREATE POLICY "Users can mark own user notifications read"
      ON public.notifications
      FOR UPDATE
      TO authenticated
      USING (recipient_id = auth.uid())
      WITH CHECK (recipient_id = auth.uid() AND is_read = true);
  END IF;
END $$;

-- ============================================================
-- 3. transaction_documents: new document kinds
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.transaction_documents
    DROP CONSTRAINT IF EXISTS transaction_documents_document_kind_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.transaction_documents
  ADD CONSTRAINT transaction_documents_document_kind_check
  CHECK (document_kind IN (
    'valid_id', 'proof_of_billing', 'invoice', 'receipt', 'sale_document', 'sale_certificate',
    'payment_receipt', 'sell_photo', 'orcr', 'deed_of_sale', 'inspection_photo', 'expense_proof'
  ));

-- ============================================================
-- 4. purchase_details: bank transfer
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.purchase_details
    DROP CONSTRAINT IF EXISTS purchase_details_payment_method_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.purchase_details
  ADD CONSTRAINT purchase_details_payment_method_check
  CHECK (payment_method IN ('cash', 'financing', 'cheque', 'down_payment', 'bank_transfer'));

-- ============================================================
-- 5. customer_standing: staff-written, customer-readable
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_standing (
  account_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  no_show_count INTEGER NOT NULL DEFAULT 0 CHECK (no_show_count >= 0),
  strike_count INTEGER NOT NULL DEFAULT 0 CHECK (strike_count >= 0),
  gce_visit_only BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS customer_standing_updated_at ON public.customer_standing;
CREATE TRIGGER customer_standing_updated_at
  BEFORE UPDATE ON public.customer_standing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.customer_standing ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Customers can read own standing'
      AND tablename = 'customer_standing'
  ) THEN
    CREATE POLICY "Customers can read own standing"
      ON public.customer_standing
      FOR SELECT
      TO authenticated
      USING (account_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Sales Manager and CEO can read standing'
      AND tablename = 'customer_standing'
  ) THEN
    CREATE POLICY "Sales Manager and CEO can read standing"
      ON public.customer_standing
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role IN ('sales_manager', 'ceo')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Sales Manager and CEO can create standing'
      AND tablename = 'customer_standing'
  ) THEN
    CREATE POLICY "Sales Manager and CEO can create standing"
      ON public.customer_standing
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role IN ('sales_manager', 'ceo')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Sales Manager and CEO can update standing'
      AND tablename = 'customer_standing'
  ) THEN
    CREATE POLICY "Sales Manager and CEO can update standing"
      ON public.customer_standing
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role IN ('sales_manager', 'ceo')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role IN ('sales_manager', 'ceo')
        )
      );
  END IF;
END $$;
