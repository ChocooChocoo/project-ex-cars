-- Fix RLS policy gaps — idempotent version.
-- Skips any policy that already exists.
-- Updated: 8 August 2026

-- ============================================================
-- VEHICLES: Add DELETE policy, expand INSERT/UPDATE roles
-- ============================================================

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'CEO and Marketing and Sales Manager can delete vehicles' AND tablename = 'vehicles') THEN
  CREATE POLICY "CEO and Marketing and Sales Manager can delete vehicles"
    ON public.vehicles FOR DELETE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'marketing_specialist', 'sales_manager')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Marketing CEO and Sales Manager can insert vehicles' AND tablename = 'vehicles') THEN
  CREATE POLICY "Marketing CEO and Sales Manager can insert vehicles"
    ON public.vehicles FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'marketing_specialist', 'sales_manager')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Marketing CEO and Sales Manager can update vehicles' AND tablename = 'vehicles') THEN
  CREATE POLICY "Marketing CEO and Sales Manager can update vehicles"
    ON public.vehicles FOR UPDATE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'marketing_specialist', 'sales_manager')));
END IF; END $$;

-- ============================================================
-- VEHICLE MEDIA: Add CEO to INSERT/UPDATE/DELETE
-- ============================================================

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Marketing and CEO can manage media' AND tablename = 'vehicle_media') THEN
  CREATE POLICY "Marketing and CEO can manage media"
    ON public.vehicle_media FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'marketing_specialist')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Marketing and CEO can update media' AND tablename = 'vehicle_media') THEN
  CREATE POLICY "Marketing and CEO can update media"
    ON public.vehicle_media FOR UPDATE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'marketing_specialist')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Marketing and CEO can delete media' AND tablename = 'vehicle_media') THEN
  CREATE POLICY "Marketing and CEO can delete media"
    ON public.vehicle_media FOR DELETE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'marketing_specialist')));
END IF; END $$;

-- ============================================================
-- VEHICLE INSPECTIONS: Add CEO to INSERT/UPDATE/DELETE
-- ============================================================

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can create inspections' AND tablename = 'vehicle_inspections') THEN
  CREATE POLICY "Mechanic and CEO can create inspections"
    ON public.vehicle_inspections FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can update inspections' AND tablename = 'vehicle_inspections') THEN
  CREATE POLICY "Mechanic and CEO can update inspections"
    ON public.vehicle_inspections FOR UPDATE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can delete inspections' AND tablename = 'vehicle_inspections') THEN
  CREATE POLICY "Mechanic and CEO can delete inspections"
    ON public.vehicle_inspections FOR DELETE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

-- ============================================================
-- REPAIRS: Add CEO to INSERT/UPDATE/DELETE
-- ============================================================

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can create repairs' AND tablename = 'repairs') THEN
  CREATE POLICY "Mechanic and CEO can create repairs"
    ON public.repairs FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can update repairs' AND tablename = 'repairs') THEN
  CREATE POLICY "Mechanic and CEO can update repairs"
    ON public.repairs FOR UPDATE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can delete repairs' AND tablename = 'repairs') THEN
  CREATE POLICY "Mechanic and CEO can delete repairs"
    ON public.repairs FOR DELETE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

-- ============================================================
-- INSPECTION CHECKLIST RESULTS: Add CEO policies
-- ============================================================

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can insert checklist results' AND tablename = 'inspection_checklist_results') THEN
  CREATE POLICY "Mechanic and CEO can insert checklist results"
    ON public.inspection_checklist_results FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can update checklist results' AND tablename = 'inspection_checklist_results') THEN
  CREATE POLICY "Mechanic and CEO can update checklist results"
    ON public.inspection_checklist_results FOR UPDATE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can delete checklist results' AND tablename = 'inspection_checklist_results') THEN
  CREATE POLICY "Mechanic and CEO can delete checklist results"
    ON public.inspection_checklist_results FOR DELETE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

-- ============================================================
-- PART REPLACEMENTS: Add CEO policies
-- ============================================================

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can insert part replacements' AND tablename = 'part_replacements') THEN
  CREATE POLICY "Mechanic and CEO can insert part replacements"
    ON public.part_replacements FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can update part replacements' AND tablename = 'part_replacements') THEN
  CREATE POLICY "Mechanic and CEO can update part replacements"
    ON public.part_replacements FOR UPDATE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic and CEO can delete part replacements' AND tablename = 'part_replacements') THEN
  CREATE POLICY "Mechanic and CEO can delete part replacements"
    ON public.part_replacements FOR DELETE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'mechanic')));
END IF; END $$;

-- ============================================================
-- FAVOURITES: Add staff SELECT policy
-- ============================================================

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can read all favourites' AND tablename = 'favourites') THEN
  CREATE POLICY "Staff can read all favourites"
    ON public.favourites FOR SELECT
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role IN ('ceo', 'sales_manager', 'marketing_specialist', 'account_manager')));
END IF; END $$;
