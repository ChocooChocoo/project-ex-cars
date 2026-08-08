-- 00020: Phase 6 — Product Roadmap (initiatives, epics, features)
-- Roadmap items form a hierarchy: initiative (parent_id NULL) > epic > feature.
-- Staff roles read all items; CEO, Account Manager, and Sales Manager write.

CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.roadmap_items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('initiative', 'epic', 'feature')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'on_hold')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  quarter TEXT CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  year INTEGER CHECK (year IS NULL OR (year >= 2000 AND year <= 2100)),
  team TEXT CHECK (team IS NULL OR char_length(team) <= 100),
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_roadmap_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT chk_roadmap_kind_hierarchy CHECK (
    (kind = 'initiative' AND parent_id IS NULL)
    OR (kind <> 'initiative' AND parent_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_roadmap_items_parent ON public.roadmap_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_kind ON public.roadmap_items(kind);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_quarter ON public.roadmap_items(quarter, year);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_status ON public.roadmap_items(status);

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff roles can read all roadmap items" ON public.roadmap_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid() AND active = true
  ));

CREATE POLICY "CEO, Account Manager, and Sales Manager can insert roadmap items" ON public.roadmap_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager', 'sales_manager')
  ));

CREATE POLICY "CEO, Account Manager, and Sales Manager can update roadmap items" ON public.roadmap_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager', 'sales_manager')
  ));

CREATE POLICY "CEO, Account Manager, and Sales Manager can delete roadmap items" ON public.roadmap_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
    AND active = true AND role IN ('ceo', 'account_manager', 'sales_manager')
  ));
