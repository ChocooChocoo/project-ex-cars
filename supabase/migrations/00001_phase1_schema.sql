-- Phase 1: One Shared Foundation
-- Tables: profiles, private.user_roles, customer_documents, audit_events, suppliers, supplier_documents

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Private schema for protected tables
CREATE SCHEMA IF NOT EXISTS private;

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  address TEXT,
  phone TEXT,
  account_state TEXT NOT NULL DEFAULT 'active' CHECK (account_state IN ('invited', 'active', 'suspended', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, account_state, created_at, updated_at)
  VALUES (NEW.id, 'active', now(), now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- User roles (private schema, protected from direct browser access)
CREATE TABLE private.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'customer', 'supplier', 'ceo', 'account_manager', 'head_accountant',
    'confidential_informant', 'marketing_specialist', 'mechanic',
    'sales_manager', 'head_security'
  )),
  active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);

-- Default role on profile creation: customer
CREATE OR REPLACE FUNCTION private.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO private.user_roles (account_id, role)
  VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user_role();

-- Updated-at trigger helper
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Customer documents
CREATE TABLE public.customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_kind TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  verification_state TEXT NOT NULL DEFAULT 'pending' CHECK (verification_state IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_documents_customer ON public.customer_documents(customer_id);

-- Audit events (immutable records)
CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  record_kind TEXT NOT NULL,
  record_id UUID NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_events_actor ON public.audit_events(actor_id);
CREATE INDEX idx_audit_events_record ON public.audit_events(record_kind, record_id);
CREATE INDEX idx_audit_events_time ON public.audit_events(created_at DESC);

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES auth.users(id),
  supplier_kind TEXT NOT NULL CHECK (supplier_kind IN ('company', 'individual')),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  creation_route TEXT NOT NULL DEFAULT 'staff-created' CHECK (creation_route IN ('staff-created', 'portal')),
  invitation_evidence_path TEXT,
  approval_decision TEXT CHECK (approval_decision IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  state TEXT NOT NULL DEFAULT 'pending_approval' CHECK (state IN ('invited', 'registered', 'pending_approval', 'approved', 'rejected', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_account ON public.suppliers(account_id);
CREATE INDEX idx_suppliers_state ON public.suppliers(state);
CREATE INDEX idx_suppliers_created_by ON public.suppliers(created_by);

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Supplier documents
CREATE TABLE public.supplier_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  document_kind TEXT NOT NULL,
  is_primary_id BOOLEAN NOT NULL DEFAULT false,
  storage_path TEXT NOT NULL,
  verification_state TEXT NOT NULL DEFAULT 'pending' CHECK (verification_state IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_documents_supplier ON public.supplier_documents(supplier_id);

-- RLS Policies

-- Profiles: users can read their own, staff can read all
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Staff can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid()
      AND role IN ('ceo', 'account_manager', 'head_accountant', 'confidential_informant', 'marketing_specialist', 'mechanic', 'sales_manager', 'head_security')
      AND active = true
    )
  );

-- Customer documents: own documents or staff access
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own documents"
  ON public.customer_documents FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert own documents"
  ON public.customer_documents FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Staff can read all customer documents"
  ON public.customer_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid()
      AND role IN ('ceo', 'account_manager', 'head_accountant', 'sales_manager')
      AND active = true
    )
  );

CREATE POLICY "Staff can verify customer documents"
  ON public.customer_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid()
      AND role IN ('ceo', 'account_manager', 'head_accountant', 'sales_manager')
      AND active = true
    )
  );

-- Audit events: read-only for staff, insert-only for all authenticated
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read audit events"
  ON public.audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid()
      AND role IN ('ceo', 'account_manager', 'head_accountant')
      AND active = true
    )
  );

CREATE POLICY "Authenticated users can create audit events"
  ON public.audit_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Audit events cannot be updated or deleted by anyone
CREATE POLICY "No one can update audit events"
  ON public.audit_events FOR UPDATE
  USING (false);

CREATE POLICY "No one can delete audit events"
  ON public.audit_events FOR DELETE
  USING (false);

-- Suppliers: staff can manage, suppliers can read own
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read all suppliers"
  ON public.suppliers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid()
      AND role IN ('ceo', 'account_manager', 'head_accountant', 'confidential_informant', 'sales_manager')
      AND active = true
    )
  );

CREATE POLICY "Staff can create suppliers"
  ON public.suppliers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid()
      AND role IN ('ceo', 'account_manager', 'head_accountant', 'confidential_informant', 'sales_manager')
      AND active = true
    )
  );

CREATE POLICY "Staff can update suppliers"
  ON public.suppliers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid()
      AND role IN ('ceo', 'account_manager', 'head_accountant')
      AND active = true
    )
  );

CREATE POLICY "Approved suppliers can read own record"
  ON public.suppliers FOR SELECT
  USING (
    account_id = auth.uid()
    AND state = 'approved'
  );

-- Supplier documents
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read all supplier documents"
  ON public.supplier_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid()
      AND role IN ('ceo', 'account_manager', 'head_accountant')
      AND active = true
    )
  );

CREATE POLICY "Staff can insert supplier documents"
  ON public.supplier_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid()
      AND role IN ('ceo', 'account_manager', 'head_accountant', 'confidential_informant', 'sales_manager')
      AND active = true
    )
  );

-- Storage buckets (run these via Supabase dashboard or API)
-- Note: Bucket creation is handled via Supabase dashboard/API, not SQL.
-- The SQL below documents the expected bucket configuration.

-- Expected buckets:
-- customer-documents  (private)
-- supplier-documents  (private)

-- Helper function to read user roles (bridges private schema)
CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS TABLE(account_id UUID, role TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ur.account_id, ur.role
  FROM private.user_roles ur
  WHERE ur.active = true;
$$;

-- Grant execute on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_roles() TO authenticated;
