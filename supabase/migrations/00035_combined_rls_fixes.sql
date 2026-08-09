-- Combined RLS fixes (migrations 00029–00034)
-- Run with: node scripts/run-migration.mjs 00035_combined_rls_fixes.sql

-- 00029: vehicle_requests customer INSERT
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can create own requests' AND tablename = 'vehicle_requests') THEN
  CREATE POLICY "Customers can create own requests"
    ON public.vehicle_requests FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.transactions
        WHERE id = vehicle_requests.transaction_id
        AND customer_id = auth.uid()
      )
    );
END IF; END $$;

-- 00030: inquiries sales manager self-assign UPDATE
DROP POLICY IF EXISTS "Staff can update assigned inquiries" ON public.inquiries;
CREATE POLICY "Staff can update assigned inquiries"
  ON public.inquiries FOR UPDATE
  USING (
    (assigned_account_manager = auth.uid() OR assigned_sales_manager = auth.uid())
    OR EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'sales_manager')
    )
  );

-- 00031: purchase_details customer INSERT + UPDATE
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can create own purchase details' AND tablename = 'purchase_details') THEN
  CREATE POLICY "Customers can create own purchase details"
    ON public.purchase_details FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.transactions
        WHERE id = purchase_details.transaction_id
        AND customer_id = auth.uid()
      )
    );
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can update own purchase details' AND tablename = 'purchase_details') THEN
  CREATE POLICY "Customers can update own purchase details"
    ON public.purchase_details FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.transactions
        WHERE id = purchase_details.transaction_id
        AND customer_id = auth.uid()
      )
    );
END IF; END $$;

-- 00032: transactions customer UPDATE + transaction_status_history INSERT
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can update own transactions' AND tablename = 'transactions') THEN
  CREATE POLICY "Customers can update own transactions"
    ON public.transactions FOR UPDATE
    USING (customer_id = auth.uid());
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can record own status history' AND tablename = 'transaction_status_history') THEN
  CREATE POLICY "Customers can record own status history"
    ON public.transaction_status_history FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.transactions
        WHERE id = transaction_status_history.transaction_id
        AND customer_id = auth.uid()
      )
    );
END IF; END $$;

-- 00033: sell_details customer INSERT
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can create own sell details' AND tablename = 'sell_details') THEN
  CREATE POLICY "Customers can create own sell details"
    ON public.sell_details FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.transactions
        WHERE id = sell_details.transaction_id
        AND customer_id = auth.uid()
      )
    );
END IF; END $$;

-- 00034: vehicles draft INSERT for customers
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can create draft vehicles' AND tablename = 'vehicles') THEN
  CREATE POLICY "Customers can create draft vehicles"
    ON public.vehicles FOR INSERT
    WITH CHECK (listing_state = 'draft');
END IF; END $$;
