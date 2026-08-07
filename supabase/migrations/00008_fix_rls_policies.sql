-- Fix RLS policy gaps across all tables.
-- 1. Grant authenticated permission to read private.user_roles (REQUIRED for all RLS policy evaluation)
-- 2. Add missing DELETE policies
-- 3. Expand INSERT/UPDATE permissions to include CEO and other relevant roles

-- ============================================================
-- PREREQUISITE: Grant access to private.user_roles for RLS evaluation
-- ============================================================
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT SELECT (account_id, role, active) ON private.user_roles TO authenticated;

-- ============================================================
-- VEHICLES: Add DELETE policy, expand INSERT/UPDATE roles
-- ============================================================

-- CEO, marketing, and sales_manager can delete vehicles
DROP POLICY IF EXISTS "CEO and Marketing and Sales Manager can delete vehicles" ON public.vehicles;
CREATE POLICY "CEO and Marketing and Sales Manager can delete vehicles"
  ON public.vehicles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist', 'sales_manager')
    )
  );

-- Expand INSERT to include CEO and sales_manager
DROP POLICY IF EXISTS "Marketing can insert vehicles" ON public.vehicles;
CREATE POLICY "Marketing CEO and Sales Manager can insert vehicles"
  ON public.vehicles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist', 'sales_manager')
    )
  );

-- Expand UPDATE to include sales_manager
DROP POLICY IF EXISTS "Marketing and CEO can update vehicles" ON public.vehicles;
CREATE POLICY "Marketing CEO and Sales Manager can update vehicles"
  ON public.vehicles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist', 'sales_manager')
    )
  );

-- ============================================================
-- VEHICLE MEDIA: Expand to include CEO
-- ============================================================

DROP POLICY IF EXISTS "Marketing can manage media" ON public.vehicle_media;
CREATE POLICY "Marketing and CEO can manage media"
  ON public.vehicle_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist')
    )
  );

DROP POLICY IF EXISTS "Marketing can update media" ON public.vehicle_media;
CREATE POLICY "Marketing and CEO can update media"
  ON public.vehicle_media FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist')
    )
  );

DROP POLICY IF EXISTS "Marketing can delete media" ON public.vehicle_media;
CREATE POLICY "Marketing and CEO can delete media"
  ON public.vehicle_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist')
    )
  );

-- ============================================================
-- VEHICLE INSPECTIONS: Add CEO to INSERT/UPDATE/DELETE
-- ============================================================

DROP POLICY IF EXISTS "Mechanic can create inspections" ON public.vehicle_inspections;
CREATE POLICY "Mechanic and CEO can create inspections"
  ON public.vehicle_inspections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

DROP POLICY IF EXISTS "Mechanic can update own inspections" ON public.vehicle_inspections;
CREATE POLICY "Mechanic and CEO can update inspections"
  ON public.vehicle_inspections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

DROP POLICY IF EXISTS "Mechanic and CEO can delete inspections" ON public.vehicle_inspections;
CREATE POLICY "Mechanic and CEO can delete inspections"
  ON public.vehicle_inspections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

-- ============================================================
-- REPAIRS: Add CEO to INSERT/UPDATE/DELETE
-- ============================================================

DROP POLICY IF EXISTS "Mechanic can manage repairs" ON public.repairs;
CREATE POLICY "Mechanic and CEO can create repairs"
  ON public.repairs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

DROP POLICY IF EXISTS "Mechanic can update repairs" ON public.repairs;
CREATE POLICY "Mechanic and CEO can update repairs"
  ON public.repairs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

DROP POLICY IF EXISTS "Mechanic and CEO can delete repairs" ON public.repairs;
CREATE POLICY "Mechanic and CEO can delete repairs"
  ON public.repairs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

-- ============================================================
-- INSPECTION CHECKLIST RESULTS: Add CEO to INSERT/UPDATE/DELETE and expand SELECT
-- ============================================================

DROP POLICY IF EXISTS "Mechanic can manage checklist results" ON public.inspection_checklist_results;
CREATE POLICY "Mechanic and CEO can insert checklist results"
  ON public.inspection_checklist_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

DROP POLICY IF EXISTS "Mechanic and CEO can update checklist results" ON public.inspection_checklist_results;
CREATE POLICY "Mechanic and CEO can update checklist results"
  ON public.inspection_checklist_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

DROP POLICY IF EXISTS "Mechanic and CEO can delete checklist results" ON public.inspection_checklist_results;
CREATE POLICY "Mechanic and CEO can delete checklist results"
  ON public.inspection_checklist_results FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

-- ============================================================
-- PART REPLACEMENTS: Add CEO to INSERT/UPDATE/DELETE
-- ============================================================

DROP POLICY IF EXISTS "Mechanic can manage part replacements" ON public.part_replacements;
CREATE POLICY "Mechanic and CEO can insert part replacements"
  ON public.part_replacements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

DROP POLICY IF EXISTS "Mechanic and CEO can update part replacements" ON public.part_replacements;
CREATE POLICY "Mechanic and CEO can update part replacements"
  ON public.part_replacements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

DROP POLICY IF EXISTS "Mechanic and CEO can delete part replacements" ON public.part_replacements;
CREATE POLICY "Mechanic and CEO can delete part replacements"
  ON public.part_replacements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

-- ============================================================
-- FAVOURITES: Add staff SELECT policy for analytics
-- ============================================================

DROP POLICY IF EXISTS "Staff can read all favourites" ON public.favourites;
CREATE POLICY "Staff can read all favourites"
  ON public.favourites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'marketing_specialist', 'account_manager')
    )
  );
