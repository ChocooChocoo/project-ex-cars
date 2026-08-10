-- 00013: Restore RLS disabled by 00010/00012 and secure role RPCs
-- Phase 1 tables (disabled in 00010)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;

-- Phase 2 tables (disabled in 00010)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_price_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_checklist_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_checklist_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_replacements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_document_items ENABLE ROW LEVEL SECURITY;

-- Phase 3 tables (disabled in 00010)
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_arrangements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

-- Phase 4 tables (disabled in 00010)
ALTER TABLE public.recommendation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;

-- Phase 5 tables (disabled in 00012)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sell_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Replace get_user_roles(): restrict to own roles for regular users
-- Add admin variant for CEO/AM to see all roles
-- ============================================================================

-- Revoke old grant
REVOKE EXECUTE ON FUNCTION public.get_user_roles() FROM authenticated;

-- New: returns only the authenticated user's own active roles
CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS TABLE(account_id UUID, role TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ur.account_id, ur.role
  FROM private.user_roles ur
  WHERE ur.account_id = auth.uid()
    AND ur.active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_roles() TO authenticated;

-- Admin variant: returns all active roles (only for CEO / Account Manager)
CREATE OR REPLACE FUNCTION public.get_all_user_roles()
RETURNS TABLE(account_id UUID, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles ur
    WHERE ur.account_id = auth.uid()
      AND ur.active = true
      AND ur.role IN ('ceo', 'account_manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only CEO or Account Manager can list all roles';
  END IF;

  RETURN QUERY
    SELECT ur.account_id, ur.role
    FROM private.user_roles ur
    WHERE ur.active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_user_roles() TO authenticated;

-- ============================================================================
-- Replace assign_user_role(): actor derived from auth.uid(), authorization enforced
-- ============================================================================

-- Revoke old grant
REVOKE EXECUTE ON FUNCTION public.assign_user_role(UUID, TEXT, UUID) FROM authenticated;

-- New: caller is derived from auth.uid(), must be CEO or Account Manager
-- The p_assigned_by parameter is kept for audit compatibility but validated against auth.uid()
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_account_id UUID,
  p_role TEXT,
  p_assigned_by UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_allowed_roles TEXT[] := ARRAY[
    'customer', 'supplier', 'ceo', 'account_manager', 'head_accountant',
    'confidential_informant', 'marketing_specialist', 'mechanic',
    'sales_manager', 'head_security'
  ];
BEGIN
  -- p_assigned_by must match the authenticated caller
  IF p_assigned_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'assigned_by must match the authenticated user';
  END IF;

  -- Caller must be CEO or Account Manager
  IF NOT EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE account_id = auth.uid()
      AND active = true
      AND role IN ('ceo', 'account_manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only CEO or Account Manager can assign roles';
  END IF;

  -- Validate the target role is in the allowed set
  IF p_role IS NULL OR NOT (p_role = ANY(v_allowed_roles)) THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  INSERT INTO private.user_roles (account_id, role, assigned_by, active)
  VALUES (p_account_id, p_role, auth.uid(), true)
  ON CONFLICT (account_id)
  DO UPDATE SET role = EXCLUDED.role, assigned_by = auth.uid(), assigned_at = now(), active = true;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_user_role(UUID, TEXT, UUID) TO authenticated;
