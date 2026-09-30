-- 00052: T01 Phase 4 — Cash Purchase: Delivery (GCE Process Flows §4)
-- - payment_records.payment_kind: tells the delivery fee, downpayment, balance and reschedule fee apart.
-- - The Sales Manager may record (not verify) a buyer's payment. §2/§3/§4 have the Sales Manager take
--   the cash and mark the car sold, but the 00011 policy only let the CEO and Head Accountant write.
-- - purchase_details: delivery terms (serviceable, fee, downpayment, deadline, forfeit).
-- - field_cases: Head Security on the delivery team, buyer-visible delivery status, delay notice.
-- - Head Security can read the cases they are assigned to and is listed in the worker directory.

-- ============================================================
-- 1. Payments
-- ============================================================
ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS payment_kind TEXT
    CHECK (payment_kind IN ('full', 'delivery_fee', 'downpayment', 'balance', 'reschedule_fee'));

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Sales Manager can record buyer payments' AND tablename = 'payment_records'
  ) THEN
    CREATE POLICY "Sales Manager can record buyer payments"
      ON public.payment_records FOR INSERT
      TO authenticated
      WITH CHECK (
        recorded_by = auth.uid()
        AND verified_by IS NULL
        AND installment_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.transactions
          WHERE transactions.id = payment_records.transaction_id
            AND transactions.transaction_kind = 'buy'
        )
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'sales_manager'
        )
      );
  END IF;
END $$;

-- ============================================================
-- 2. Delivery terms
-- ============================================================
ALTER TABLE public.purchase_details
  ADD COLUMN IF NOT EXISTS delivery_serviceable BOOLEAN,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) CHECK (delivery_fee >= 0),
  ADD COLUMN IF NOT EXISTS downpayment_amount NUMERIC(12,2) CHECK (downpayment_amount >= 0),
  ADD COLUMN IF NOT EXISTS downpayment_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS downpayment_forfeited_at TIMESTAMPTZ;

-- ============================================================
-- 3. Delivery field case
-- ============================================================
ALTER TABLE public.field_cases
  ADD COLUMN IF NOT EXISTS head_security_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delivery_status TEXT
    CHECK (delivery_status IN ('dispatched', 'in_transit', 'arriving', 'delivered')),
  ADD COLUMN IF NOT EXISTS delay_note TEXT,
  ADD COLUMN IF NOT EXISTS expected_arrival TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Head Security can read assigned field cases' AND tablename = 'field_cases'
  ) THEN
    CREATE POLICY "Head Security can read assigned field cases"
      ON public.field_cases FOR SELECT
      TO authenticated
      USING (
        head_security_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'head_security'
        )
      );
  END IF;
END $$;

-- ============================================================
-- 4. Worker directory includes Head Security
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
    AND worker.role IN ('confidential_informant', 'mechanic', 'head_security')
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
