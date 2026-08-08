-- Phase 5: Transactions Can Be Followed — Buy, Sell, Request-a-Car
-- Tables: transactions, transaction_status_history, purchase_details, sell_details,
--         vehicle_requests, transaction_documents, installment_accounts, installments,
--         payment_records, collection_actions, field_cases, payment_terms
--
-- Note: 00010_disable_rls_testing.sql disables RLS on pre-existing tables for local testing.
-- This migration is production-correct (RLS ON). Run 00012 afterward to disable RLS on these
-- new tables to match the local testing posture.

-- ============================================================
-- 1. transactions
-- ============================================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  transaction_kind TEXT NOT NULL CHECK (transaction_kind IN ('buy', 'sell', 'request_a_car')),
  vehicle_id UUID REFERENCES public.vehicles(id),
  current_state TEXT NOT NULL DEFAULT 'pending' CHECK (current_state IN ('pending', 'under_review', 'approved', 'rejected', 'completed', 'cancelled')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_customer ON public.transactions(customer_id, opened_at DESC);
CREATE INDEX idx_transactions_queue ON public.transactions(transaction_kind, current_state, opened_at DESC);
CREATE INDEX idx_transactions_vehicle ON public.transactions(vehicle_id);

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2. transaction_status_history
-- ============================================================
CREATE TABLE public.transaction_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  from_state TEXT NOT NULL CHECK (from_state IN ('pending', 'under_review', 'approved', 'rejected', 'completed', 'cancelled')),
  to_state TEXT NOT NULL CHECK (to_state IN ('pending', 'under_review', 'approved', 'rejected', 'completed', 'cancelled')),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_transaction ON public.transaction_status_history(transaction_id, changed_at);

-- ============================================================
-- 3. purchase_details
-- ============================================================
CREATE TABLE public.purchase_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'financing', 'cheque', 'down_payment')),
  final_price NUMERIC(12,2) CHECK (final_price >= 0),
  arrangement_kind TEXT CHECK (arrangement_kind IN ('delivery', 'meetup', 'gce_visit')),
  document_check_state TEXT NOT NULL DEFAULT 'pending' CHECK (document_check_state IN ('pending', 'verified', 'rejected')),
  checked_by UUID REFERENCES auth.users(id),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER purchase_details_updated_at
  BEFORE UPDATE ON public.purchase_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 4. sell_details
-- ============================================================
CREATE TABLE public.sell_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  offered_amount NUMERIC(12,2) CHECK (offered_amount >= 0),
  valuation_amount NUMERIC(12,2) CHECK (valuation_amount >= 0),
  review_notes TEXT,
  decision TEXT CHECK (decision IN ('accepted', 'rejected')),
  decision_maker_id UUID REFERENCES auth.users(id),
  decision_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER sell_details_updated_at
  BEFORE UPDATE ON public.sell_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 5. vehicle_requests
-- ============================================================
CREATE TABLE public.vehicle_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  requested_make TEXT NOT NULL,
  requested_model TEXT NOT NULL,
  year_min INTEGER CHECK (year_min >= 1900),
  year_max INTEGER CHECK (year_max >= 1900),
  budget NUMERIC(12,2) CHECK (budget >= 0),
  other_preferences TEXT,
  agreed_price NUMERIC(12,2) CHECK (agreed_price >= 0),
  assigned_confidential_informant UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_requests_year_range CHECK (year_min IS NULL OR year_max IS NULL OR year_max >= year_min)
);

CREATE TRIGGER vehicle_requests_updated_at
  BEFORE UPDATE ON public.vehicle_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 6. transaction_documents
-- ============================================================
CREATE TABLE public.transaction_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  document_kind TEXT NOT NULL CHECK (document_kind IN ('valid_id', 'proof_of_billing', 'invoice', 'receipt', 'sale_document', 'sale_certificate', 'payment_receipt')),
  storage_path TEXT,
  uploader_id UUID REFERENCES auth.users(id),
  verification_state TEXT NOT NULL DEFAULT 'pending' CHECK (verification_state IN ('pending', 'verified', 'rejected')),
  verifier_id UUID REFERENCES auth.users(id),
  upload_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transaction_docs ON public.transaction_documents(transaction_id, document_kind);

-- ============================================================
-- 7. installment_accounts
-- ============================================================
CREATE TABLE public.installment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_transaction_id UUID NOT NULL UNIQUE REFERENCES public.transactions(id),
  financed_total NUMERIC(12,2) NOT NULL CHECK (financed_total >= 0),
  down_payment NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (down_payment >= 0),
  opening_balance NUMERIC(12,2) NOT NULL CHECK (opening_balance >= 0),
  start_date DATE NOT NULL,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'closed')),
  closed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER installment_accounts_updated_at
  BEFORE UPDATE ON public.installment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 8. installments
-- ============================================================
CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.installment_accounts(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount_due NUMERIC(12,2) NOT NULL CHECK (amount_due >= 0),
  state TEXT NOT NULL DEFAULT 'upcoming' CHECK (state IN ('upcoming', 'due', 'paid', 'overdue', 'waived')),
  payment_date DATE,
  UNIQUE (account_id, sequence_no)
);

CREATE INDEX idx_installments_state_due ON public.installments(state, due_date);

-- ============================================================
-- 9. payment_records
-- ============================================================
CREATE TABLE public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  installment_id UUID REFERENCES public.installments(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'financing', 'cheque', 'bank_transfer')),
  external_reference TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  verified_by UUID REFERENCES auth.users(id),
  settlement_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_records_transaction ON public.payment_records(transaction_id);
CREATE INDEX idx_payment_records_installment ON public.payment_records(installment_id);
CREATE INDEX idx_payment_records_date ON public.payment_records(settlement_date);

-- ============================================================
-- 10. collection_actions
-- ============================================================
CREATE TABLE public.collection_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  action_kind TEXT NOT NULL CHECK (action_kind IN ('notice', 'ultimatum', 'recovery_instruction', 'recovery_result')),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  deadline DATE,
  notes TEXT,
  action_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collection_actions_installment ON public.collection_actions(installment_id);

-- ============================================================
-- 11. field_cases
-- ============================================================
CREATE TABLE public.field_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id),
  transaction_id UUID REFERENCES public.transactions(id),
  case_kind TEXT NOT NULL CHECK (case_kind IN ('acquisition', 'delivery', 'recovery', 'sourcing')),
  assigned_confidential_informant UUID REFERENCES auth.users(id),
  mechanic_id UUID REFERENCES auth.users(id),
  schedule TIMESTAMPTZ,
  location TEXT,
  state TEXT NOT NULL DEFAULT 'assigned' CHECK (state IN ('assigned', 'accepted', 'in_progress', 'completed', 'cancelled')),
  completion_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_field_cases_informant ON public.field_cases(assigned_confidential_informant, state);
CREATE INDEX idx_field_cases_kind ON public.field_cases(case_kind, state);

CREATE TRIGGER field_cases_updated_at
  BEFORE UPDATE ON public.field_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 12. payment_terms
-- ============================================================
CREATE TABLE public.payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_transaction_id UUID NOT NULL UNIQUE REFERENCES public.transactions(id),
  arrangement_description TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  down_payment NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (down_payment >= 0),
  number_of_payments INTEGER NOT NULL CHECK (number_of_payments >= 1),
  payment_frequency TEXT NOT NULL CHECK (payment_frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
  first_due_date DATE NOT NULL,
  agreed_by UUID NOT NULL REFERENCES auth.users(id),
  approver_id UUID REFERENCES auth.users(id),
  approval_date TIMESTAMPTZ,
  state TEXT NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'approved', 'rejected', 'active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER payment_terms_updated_at
  BEFORE UPDATE ON public.payment_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- FK on existing viewing_arrangements table
-- ============================================================
ALTER TABLE public.viewing_arrangements
  ADD CONSTRAINT fk_arrangements_transaction
  FOREIGN KEY (purchase_transaction_id) REFERENCES public.transactions(id);

-- ============================================================
-- Storage bucket for transaction documents (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-documents', 'transaction-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- --- transactions ---
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own transactions"
  ON public.transactions FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Customers can create own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Staff can read all transactions"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'account_manager', 'head_accountant', 'confidential_informant')
    )
  );

CREATE POLICY "Staff can update transactions"
  ON public.transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'account_manager', 'head_accountant')
    )
  );

-- --- transaction_status_history ---
ALTER TABLE public.transaction_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own status history"
  ON public.transaction_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = transaction_status_history.transaction_id
      AND customer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read all status history"
  ON public.transaction_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'account_manager', 'head_accountant', 'confidential_informant')
    )
  );

CREATE POLICY "Staff can insert status history"
  ON public.transaction_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'account_manager', 'head_accountant')
    )
  );

-- --- purchase_details ---
ALTER TABLE public.purchase_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own purchase details"
  ON public.purchase_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = purchase_details.transaction_id
      AND customer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read all purchase details"
  ON public.purchase_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'account_manager', 'head_accountant')
    )
  );

CREATE POLICY "Staff can manage purchase details"
  ON public.purchase_details FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager')
    )
  );

-- --- sell_details ---
ALTER TABLE public.sell_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own sell details"
  ON public.sell_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = sell_details.transaction_id
      AND customer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read all sell details"
  ON public.sell_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'account_manager', 'confidential_informant')
    )
  );

CREATE POLICY "Staff can manage sell details"
  ON public.sell_details FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager')
    )
  );

-- --- vehicle_requests ---
ALTER TABLE public.vehicle_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own requests"
  ON public.vehicle_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = vehicle_requests.transaction_id
      AND customer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read all requests"
  ON public.vehicle_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'account_manager', 'confidential_informant')
    )
  );

CREATE POLICY "Staff can manage requests"
  ON public.vehicle_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager')
    )
  );

-- --- transaction_documents ---
ALTER TABLE public.transaction_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own documents"
  ON public.transaction_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = transaction_documents.transaction_id
      AND customer_id = auth.uid()
    )
  );

CREATE POLICY "Customers can upload documents"
  ON public.transaction_documents FOR INSERT
  WITH CHECK (uploader_id = auth.uid());

CREATE POLICY "Staff can read all documents"
  ON public.transaction_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'account_manager', 'head_accountant')
    )
  );

CREATE POLICY "Staff can manage documents"
  ON public.transaction_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager')
    )
  );

-- --- installment_accounts ---
ALTER TABLE public.installment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own installment accounts"
  ON public.installment_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = installment_accounts.purchase_transaction_id
      AND customer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read all installment accounts"
  ON public.installment_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'head_accountant', 'account_manager', 'sales_manager')
    )
  );

CREATE POLICY "Staff can manage installment accounts"
  ON public.installment_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'head_accountant')
    )
  );

-- --- installments ---
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own installments"
  ON public.installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.installment_accounts a
      JOIN public.transactions t ON t.id = a.purchase_transaction_id
      WHERE a.id = installments.account_id
      AND t.customer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read all installments"
  ON public.installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'head_accountant', 'account_manager', 'sales_manager')
    )
  );

CREATE POLICY "Staff can manage installments"
  ON public.installments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'head_accountant', 'account_manager')
    )
  );

-- --- payment_records ---
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own payment records"
  ON public.payment_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = payment_records.transaction_id
      AND customer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read all payment records"
  ON public.payment_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'head_accountant', 'account_manager', 'sales_manager')
    )
  );

CREATE POLICY "Staff can manage payment records"
  ON public.payment_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'head_accountant')
    )
  );

-- --- collection_actions ---
ALTER TABLE public.collection_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read collection actions"
  ON public.collection_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'head_accountant', 'account_manager', 'sales_manager', 'confidential_informant')
    )
  );

CREATE POLICY "Staff can manage collection actions"
  ON public.collection_actions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'head_accountant', 'account_manager')
    )
  );

-- --- field_cases ---
ALTER TABLE public.field_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read field cases"
  ON public.field_cases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'confidential_informant', 'mechanic', 'head_security', 'account_manager')
    )
  );

CREATE POLICY "Staff can manage field cases"
  ON public.field_cases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager')
    )
  );

-- --- payment_terms ---
ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own payment terms"
  ON public.payment_terms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = payment_terms.purchase_transaction_id
      AND customer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read all payment terms"
  ON public.payment_terms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'head_accountant', 'account_manager', 'sales_manager')
    )
  );

CREATE POLICY "Staff can manage payment terms"
  ON public.payment_terms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'head_accountant')
    )
  );
