-- 00041: Task 32 — supplier offering taxonomy
-- supplier_kind (company|individual) is the legal-entity type. The new
-- supplier_offering column records WHAT the supplier offers so actual vehicle
-- suppliers are representable alongside parts suppliers. Additive, backfilled.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS supplier_offering TEXT NOT NULL DEFAULT 'parts'
  CHECK (supplier_offering IN ('vehicle', 'parts', 'both'));

CREATE INDEX IF NOT EXISTS idx_suppliers_offering ON public.suppliers(supplier_offering);
