-- 00038: RBAC Least-Privilege Enforcement
-- Removes CEO from operational CRUD policies, scopes permissions to documented role responsibilities.
-- CEO retains company-wide SELECT visibility + approval/rejection authority on prices, reports, disbursements.
-- Operational write stays with the role documented for that workflow.

-- ============================================================
-- VEHICLES: Remove Sales Manager from CRUD; restrict INSERT/UPDATE to Marketing.
-- DELETE stays CEO-only per GCE docs §CEO ("Delete a vehicle record").
-- ============================================================

DROP POLICY IF EXISTS "Marketing CEO and Sales Manager can insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Marketing CEO and Sales Manager can update vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "CEO and Marketing and Sales Manager can delete vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Marketing and CEO can update vehicles" ON public.vehicles;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Marketing can update vehicles' AND tablename = 'vehicles') THEN
  CREATE POLICY "Marketing can update vehicles"
    ON public.vehicles FOR UPDATE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'CEO can delete vehicles' AND tablename = 'vehicles') THEN
  CREATE POLICY "CEO can delete vehicles"
    ON public.vehicles FOR DELETE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'ceo'));
END IF; END $$;

-- ============================================================
-- VEHICLE MEDIA: Remove CEO from write (Marketing's job)
-- ============================================================

DROP POLICY IF EXISTS "Marketing and CEO can manage media" ON public.vehicle_media;
DROP POLICY IF EXISTS "Marketing and CEO can update media" ON public.vehicle_media;
DROP POLICY IF EXISTS "Marketing and CEO can delete media" ON public.vehicle_media;

-- 00003 "Marketing can manage/update/delete media" policies stay (already marketing-only)

-- ============================================================
-- VEHICLE INSPECTIONS: Remove CEO from write (Mechanic's job per §Mechanic #1)
-- ============================================================

DROP POLICY IF EXISTS "Mechanic and CEO can create inspections" ON public.vehicle_inspections;
DROP POLICY IF EXISTS "Mechanic and CEO can update inspections" ON public.vehicle_inspections;
DROP POLICY IF EXISTS "Mechanic and CEO can delete inspections" ON public.vehicle_inspections;

-- 00003 "Mechanic can create inspections" + "Mechanic can update own inspections" stay

-- ============================================================
-- REPAIRS: Remove CEO from write (Mechanic's job per §Mechanic #2)
-- ============================================================

DROP POLICY IF EXISTS "Mechanic and CEO can create repairs" ON public.repairs;
DROP POLICY IF EXISTS "Mechanic and CEO can update repairs" ON public.repairs;
DROP POLICY IF EXISTS "Mechanic and CEO can delete repairs" ON public.repairs;

-- 00003 "Mechanic can manage/update repairs" stay

-- ============================================================
-- INSPECTION CHECKLIST RESULTS: Remove CEO from write (Mechanic's job)
-- ============================================================

DROP POLICY IF EXISTS "Mechanic and CEO can insert checklist results" ON public.inspection_checklist_results;
DROP POLICY IF EXISTS "Mechanic and CEO can update checklist results" ON public.inspection_checklist_results;
DROP POLICY IF EXISTS "Mechanic and CEO can delete checklist results" ON public.inspection_checklist_results;

-- 00003 "Mechanic can manage checklist results" stays

-- ============================================================
-- PART REPLACEMENTS: Remove CEO from write (Mechanic's job)
-- ============================================================

DROP POLICY IF EXISTS "Mechanic and CEO can insert part replacements" ON public.part_replacements;
DROP POLICY IF EXISTS "Mechanic and CEO can update part replacements" ON public.part_replacements;
DROP POLICY IF EXISTS "Mechanic and CEO can delete part replacements" ON public.part_replacements;

-- 00003 "Mechanic can manage part replacements" stays

-- ============================================================
-- CONTENT ITEMS: Remove CEO from management (Marketing's job per §Marketing Specialist #1).
-- Add CEO SELECT for draft monitoring.
-- ============================================================

DROP POLICY IF EXISTS "Marketing and CEO can manage content" ON public.content_items;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Marketing can manage content' AND tablename = 'content_items') THEN
  CREATE POLICY "Marketing can manage content"
    ON public.content_items FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Marketing can update content' AND tablename = 'content_items') THEN
  CREATE POLICY "Marketing can update content"
    ON public.content_items FOR UPDATE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Marketing can delete content' AND tablename = 'content_items') THEN
  CREATE POLICY "Marketing can delete content"
    ON public.content_items FOR DELETE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'marketing_specialist'));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'CEO can read all content' AND tablename = 'content_items') THEN
  CREATE POLICY "CEO can read all content"
    ON public.content_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'ceo'));
END IF; END $$;

-- ============================================================
-- INSPECTION CHECKLIST NODES: Remove CEO from management (Mechanic config)
-- ============================================================

DROP POLICY IF EXISTS "Mechanic and CEO can manage checklist" ON public.inspection_checklist_nodes;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic can manage checklist' AND tablename = 'inspection_checklist_nodes') THEN
  CREATE POLICY "Mechanic can manage checklist"
    ON public.inspection_checklist_nodes FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'mechanic'));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic can update checklist' AND tablename = 'inspection_checklist_nodes') THEN
  CREATE POLICY "Mechanic can update checklist"
    ON public.inspection_checklist_nodes FOR UPDATE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'mechanic'));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mechanic can delete checklist nodes' AND tablename = 'inspection_checklist_nodes') THEN
  CREATE POLICY "Mechanic can delete checklist nodes"
    ON public.inspection_checklist_nodes FOR DELETE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'mechanic'));
END IF; END $$;

-- ============================================================
-- VEHICLE DOCUMENT ITEMS: Remove CEO from management (Sales Manager's job per §Sales Manager #6)
-- ============================================================

DROP POLICY IF EXISTS "Sales Manager can manage vehicle documents" ON public.vehicle_document_items;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sales Manager can insert vehicle documents' AND tablename = 'vehicle_document_items') THEN
  CREATE POLICY "Sales Manager can insert vehicle documents"
    ON public.vehicle_document_items FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'sales_manager'));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sales Manager can update vehicle documents' AND tablename = 'vehicle_document_items') THEN
  CREATE POLICY "Sales Manager can update vehicle documents"
    ON public.vehicle_document_items FOR UPDATE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'sales_manager'));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sales Manager can delete vehicle documents' AND tablename = 'vehicle_document_items') THEN
  CREATE POLICY "Sales Manager can delete vehicle documents"
    ON public.vehicle_document_items FOR DELETE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'sales_manager'));
END IF; END $$;

-- ============================================================
-- INQUIRIES: Scope UPDATE to assigned managers only (remove CEO blanket bypass).
-- Self-claim allowed on unassigned inquiries so managers can assign themselves.
-- ============================================================

DROP POLICY IF EXISTS "Staff can update assigned inquiries" ON public.inquiries;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Assigned staff can update inquiries' AND tablename = 'inquiries') THEN
  CREATE POLICY "Assigned staff can update inquiries"
    ON public.inquiries FOR UPDATE
    USING (
      assigned_account_manager = auth.uid()
      OR assigned_sales_manager = auth.uid()
      OR (
        assigned_account_manager IS NULL
        AND assigned_sales_manager IS NULL
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true
          AND role IN ('account_manager', 'sales_manager')
        )
      )
    )
    WITH CHECK (
      assigned_account_manager = auth.uid()
      OR assigned_sales_manager = auth.uid()
    );
END IF; END $$;

-- ============================================================
-- ROADMAP ITEMS: CEO only for write (platform tooling, no documented AM/SM duty)
-- ============================================================

DROP POLICY IF EXISTS "CEO, Account Manager, and Sales Manager can insert roadmap items" ON public.roadmap_items;
DROP POLICY IF EXISTS "CEO, Account Manager, and Sales Manager can update roadmap items" ON public.roadmap_items;
DROP POLICY IF EXISTS "CEO, Account Manager, and Sales Manager can delete roadmap items" ON public.roadmap_items;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'CEO can insert roadmap items' AND tablename = 'roadmap_items') THEN
  CREATE POLICY "CEO can insert roadmap items"
    ON public.roadmap_items FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'ceo'));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'CEO can update roadmap items' AND tablename = 'roadmap_items') THEN
  CREATE POLICY "CEO can update roadmap items"
    ON public.roadmap_items FOR UPDATE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'ceo'));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'CEO can delete roadmap items' AND tablename = 'roadmap_items') THEN
  CREATE POLICY "CEO can delete roadmap items"
    ON public.roadmap_items FOR DELETE
    USING (EXISTS (SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'ceo'));
END IF; END $$;

-- ============================================================
-- VIEWING ARRANGEMENTS: Scope management to assigned managers (remove CEO/AM blanket)
-- ============================================================

DROP POLICY IF EXISTS "Staff can manage arrangements" ON public.viewing_arrangements;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Assigned staff can manage arrangements' AND tablename = 'viewing_arrangements') THEN
  CREATE POLICY "Assigned staff can manage arrangements"
    ON public.viewing_arrangements FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.inquiries
        WHERE id = viewing_arrangements.inquiry_id
        AND (assigned_account_manager = auth.uid() OR assigned_sales_manager = auth.uid())
      )
    );
END IF; END $$;

-- ============================================================
-- FIELD CASES: Remove Head Security (no documented duty), add Head Accountant (repossession instructions)
-- ============================================================

DROP POLICY IF EXISTS "Staff can read field cases" ON public.field_cases;

CREATE POLICY "Staff can read field cases"
  ON public.field_cases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true
    AND role IN ('ceo', 'sales_manager', 'confidential_informant', 'mechanic', 'account_manager', 'head_accountant')
  ));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Head Accountant can create field cases' AND tablename = 'field_cases') THEN
  CREATE POLICY "Head Accountant can create field cases"
    ON public.field_cases FOR INSERT
    WITH CHECK (EXISTS (
      SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true AND role = 'head_accountant'
    ));
END IF; END $$;
