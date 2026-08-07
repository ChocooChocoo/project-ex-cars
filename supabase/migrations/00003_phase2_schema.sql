-- Phase 2: Vehicles Can Be Found and Understood
-- Tables: vehicles, vehicle_media, vehicle_inspections, repairs,
--         vehicle_price_proposals, favourites, content_items,
--         inspection_checklist_nodes, inspection_checklist_results,
--         part_replacements, vehicle_document_items

-- 1. Vehicles
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_code TEXT NOT NULL UNIQUE,
  vin TEXT UNIQUE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 1900 AND year <= 2100),
  condition TEXT NOT NULL DEFAULT 'used',
  mileage INTEGER CHECK (mileage >= 0),
  fuel_type TEXT,
  transmission TEXT,
  exterior_color TEXT,
  interior_color TEXT,
  body_type TEXT,
  engine TEXT,
  description TEXT,
  current_price NUMERIC(12,2) CHECK (current_price >= 0),
  pricing_type TEXT NOT NULL DEFAULT 'negotiable' CHECK (pricing_type IN ('negotiable', 'fixed')),
  warranty_details TEXT,
  offer_details TEXT,
  listing_state TEXT NOT NULL DEFAULT 'draft' CHECK (listing_state IN ('draft', 'inspecting', 'repairing', 'awaiting_price_approval', 'available', 'reserved', 'sold', 'archived')),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_listing ON public.vehicles(listing_state, make, model, year, current_price);
CREATE INDEX idx_vehicles_fuel ON public.vehicles(fuel_type);
CREATE INDEX idx_vehicles_available ON public.vehicles(listing_state) WHERE listing_state = 'available';

CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Vehicle Media
CREATE TABLE public.vehicle_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  media_kind TEXT NOT NULL DEFAULT 'photo' CHECK (media_kind IN ('photo', '360_view')),
  storage_path TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  public_state BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_media_vehicle ON public.vehicle_media(vehicle_id, display_order);

-- 3. Vehicle Inspections
CREATE TABLE public.vehicle_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES auth.users(id),
  field_case_id UUID,
  condition_score INTEGER CHECK (condition_score >= 0 AND condition_score <= 100),
  findings TEXT,
  recommendation TEXT,
  inspection_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspections_vehicle ON public.vehicle_inspections(vehicle_id);
CREATE INDEX idx_inspections_mechanic ON public.vehicle_inspections(mechanic_id);

-- 4. Repairs
CREATE TABLE public.repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES auth.users(id),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_repairs_vehicle ON public.repairs(vehicle_id);
CREATE INDEX idx_repairs_mechanic ON public.repairs(mechanic_id);
CREATE INDEX idx_repairs_status ON public.repairs(status);

CREATE TRIGGER repairs_updated_at
  BEFORE UPDATE ON public.repairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. Vehicle Price Proposals
CREATE TABLE public.vehicle_price_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  proposed_amount NUMERIC(12,2) NOT NULL CHECK (proposed_amount >= 0),
  proposer_id UUID NOT NULL REFERENCES auth.users(id),
  decision TEXT CHECK (decision IN ('pending', 'approved', 'rejected')),
  decider_id UUID REFERENCES auth.users(id),
  decision_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_proposals_vehicle ON public.vehicle_price_proposals(vehicle_id);
CREATE INDEX idx_price_proposals_pending ON public.vehicle_price_proposals(decision) WHERE decision = 'pending';

-- 6. Favourites
CREATE TABLE public.favourites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, vehicle_id)
);

CREATE INDEX idx_favourites_customer ON public.favourites(customer_id);

-- 7. Content Items
CREATE TABLE public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_kind TEXT NOT NULL CHECK (content_kind IN ('hero', 'promotion', 'featured_vehicle', 'announcement')),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  image_path TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  publication_state TEXT NOT NULL DEFAULT 'draft' CHECK (publication_state IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_published ON public.content_items(publication_state, content_kind);

CREATE TRIGGER content_items_updated_at
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 8. Inspection Checklist Nodes (nested: systems -> components -> parts)
CREATE TABLE public.inspection_checklist_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.inspection_checklist_nodes(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('system', 'component', 'part')),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  checklist_version TEXT NOT NULL DEFAULT '1.0',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_nodes_parent ON public.inspection_checklist_nodes(parent_id, display_order);
CREATE INDEX idx_checklist_nodes_active ON public.inspection_checklist_nodes(active) WHERE active = true;

-- Prevent self-referencing parent
ALTER TABLE public.inspection_checklist_nodes
  ADD CONSTRAINT no_self_parent CHECK (id <> parent_id);

-- 9. Inspection Checklist Results
CREATE TABLE public.inspection_checklist_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
  checklist_entry_id UUID NOT NULL REFERENCES public.inspection_checklist_nodes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('good', 'for_repair', 'for_replacement')),
  notes TEXT,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, checklist_entry_id)
);

CREATE INDEX idx_checklist_results_inspection ON public.inspection_checklist_results(inspection_id);

-- 10. Part Replacements
CREATE TABLE public.part_replacements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_answer_id UUID NOT NULL REFERENCES public.inspection_checklist_results(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  brand TEXT,
  estimated_cost NUMERIC(12,2) CHECK (estimated_cost >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_part_replacements_answer ON public.part_replacements(checklist_answer_id);

-- 11. Vehicle Document Items
CREATE TABLE public.vehicle_document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  document_kind TEXT NOT NULL,
  required_state BOOLEAN NOT NULL DEFAULT true,
  submitted_state TEXT NOT NULL DEFAULT 'required' CHECK (submitted_state IN ('required', 'submitted', 'verified', 'rejected')),
  storage_path TEXT,
  checker_id UUID REFERENCES auth.users(id),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, document_kind)
);

CREATE INDEX idx_vehicle_documents_vehicle ON public.vehicle_document_items(vehicle_id);
CREATE INDEX idx_vehicle_documents_pending ON public.vehicle_document_items(vehicle_id) WHERE submitted_state = 'required';

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read available vehicles"
  ON public.vehicles FOR SELECT
  USING (listing_state IN ('available', 'reserved', 'sold'));

CREATE POLICY "Staff can read all vehicles"
  ON public.vehicles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'head_accountant', 'marketing_specialist', 'mechanic', 'sales_manager')
    )
  );

CREATE POLICY "Marketing can insert vehicles"
  ON public.vehicles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'marketing_specialist'
    )
  );

CREATE POLICY "Marketing and CEO can update vehicles"
  ON public.vehicles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist')
    )
  );

-- Vehicle Media
ALTER TABLE public.vehicle_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public media"
  ON public.vehicle_media FOR SELECT
  USING (public_state = true);

CREATE POLICY "Staff can read all media"
  ON public.vehicle_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'marketing_specialist', 'mechanic', 'sales_manager')
    )
  );

CREATE POLICY "Marketing can manage media"
  ON public.vehicle_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'marketing_specialist'
    )
  );

CREATE POLICY "Marketing can update media"
  ON public.vehicle_media FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'marketing_specialist'
    )
  );

CREATE POLICY "Marketing can delete media"
  ON public.vehicle_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'marketing_specialist'
    )
  );

-- Vehicle Inspections
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read inspections"
  ON public.vehicle_inspections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'mechanic', 'sales_manager', 'head_accountant', 'confidential_informant')
    )
  );

CREATE POLICY "Mechanic can create inspections"
  ON public.vehicle_inspections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'mechanic'
    )
  );

CREATE POLICY "Mechanic can update own inspections"
  ON public.vehicle_inspections FOR UPDATE
  USING (
    mechanic_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true AND role = 'mechanic'
    )
  );

-- Repairs
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read repairs"
  ON public.repairs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager', 'mechanic', 'sales_manager', 'confidential_informant')
    )
  );

CREATE POLICY "Mechanic can manage repairs"
  ON public.repairs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'mechanic'
    )
  );

CREATE POLICY "Mechanic can update repairs"
  ON public.repairs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'mechanic'
    )
  );

-- Price Proposals
ALTER TABLE public.vehicle_price_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing and CEO can read proposals"
  ON public.vehicle_price_proposals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist')
    )
  );

CREATE POLICY "Marketing can create proposals"
  ON public.vehicle_price_proposals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'marketing_specialist'
    )
  );

CREATE POLICY "CEO can update proposals"
  ON public.vehicle_price_proposals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'ceo'
    )
  );

-- Favourites
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can manage own favourites"
  ON public.favourites FOR ALL
  USING (customer_id = auth.uid());

-- Content Items
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published content"
  ON public.content_items FOR SELECT
  USING (publication_state = 'published');

CREATE POLICY "Marketing and CEO can manage content"
  ON public.content_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'marketing_specialist')
    )
  );

-- Checklist Nodes
ALTER TABLE public.inspection_checklist_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read active checklist"
  ON public.inspection_checklist_nodes FOR SELECT
  USING (active = true);

CREATE POLICY "Mechanic and CEO can manage checklist"
  ON public.inspection_checklist_nodes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic')
    )
  );

-- Checklist Results
ALTER TABLE public.inspection_checklist_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read checklist results"
  ON public.inspection_checklist_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic', 'sales_manager', 'account_manager')
    )
  );

CREATE POLICY "Mechanic can manage checklist results"
  ON public.inspection_checklist_results FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'mechanic'
    )
  );

-- Part Replacements
ALTER TABLE public.part_replacements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read part replacements"
  ON public.part_replacements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'mechanic', 'sales_manager', 'head_accountant')
    )
  );

CREATE POLICY "Mechanic can manage part replacements"
  ON public.part_replacements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'mechanic'
    )
  );

-- Vehicle Document Items
ALTER TABLE public.vehicle_document_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read vehicle documents"
  ON public.vehicle_document_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager', 'head_accountant', 'marketing_specialist')
    )
  );

CREATE POLICY "Sales Manager can manage vehicle documents"
  ON public.vehicle_document_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'sales_manager')
    )
  );
