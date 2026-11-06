BEGIN;

DELETE FROM public.payment_records
WHERE transaction_id IN (SELECT id FROM public.transactions WHERE transaction_kind = 'request_a_car');
DELETE FROM public.transactions WHERE transaction_kind = 'request_a_car';

DROP POLICY IF EXISTS "Approved suppliers can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read supplier documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload supplier documents" ON storage.objects;
SET LOCAL storage.allow_delete_query = 'true';
DELETE FROM storage.objects WHERE bucket_id = 'supplier-documents';
DELETE FROM storage.buckets WHERE id = 'supplier-documents';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public' AND tablename = 'supplier_messages') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.supplier_messages;
  END IF;
END $$;
DROP TABLE IF EXISTS public.supplier_messages;
DROP TABLE IF EXISTS public.supplier_documents;
DROP TABLE IF EXISTS public.suppliers;

DELETE FROM private.user_roles WHERE role = 'supplier';
ALTER TABLE private.user_roles DROP CONSTRAINT user_roles_role_check;
ALTER TABLE private.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN (
  'customer', 'ceo', 'account_manager', 'head_accountant', 'confidential_informant',
  'marketing_specialist', 'mechanic', 'sales_manager', 'head_security', 'super_admin'
));

DELETE FROM public.rbac_role_permissions WHERE role_key = 'supplier'
  OR permission_id IN (SELECT id FROM public.rbac_permissions
    WHERE access_area_key IN ('suppliers', 'supplier_messages', 'vehicle_requests', 'staff_showroom'));
DELETE FROM public.rbac_permissions
WHERE access_area_key IN ('suppliers', 'supplier_messages', 'vehicle_requests', 'staff_showroom');
DELETE FROM public.rbac_access_areas
WHERE key IN ('suppliers', 'supplier_messages', 'vehicle_requests', 'staff_showroom');
DELETE FROM public.rbac_roles WHERE role_key = 'supplier';
ALTER TABLE public.rbac_roles DROP CONSTRAINT rbac_roles_role_key_check;
ALTER TABLE public.rbac_roles ADD CONSTRAINT rbac_roles_role_key_check CHECK (role_key IN (
  'account_manager', 'head_accountant', 'confidential_informant', 'marketing_specialist',
  'mechanic', 'sales_manager', 'head_security'
));
UPDATE public.rbac_roles
SET description = 'Manages accounts, RBAC, staff records, inquiries, and payroll preparation.'
WHERE role_key = 'account_manager';

DROP TABLE IF EXISTS public.vehicle_requests;
ALTER TABLE public.transactions DROP CONSTRAINT transactions_transaction_kind_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_transaction_kind_check
  CHECK (transaction_kind IN ('buy', 'sell'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.field_cases WHERE case_kind = 'sourcing') THEN
    ALTER TABLE public.field_cases DROP CONSTRAINT field_cases_case_kind_check;
    ALTER TABLE public.field_cases ADD CONSTRAINT field_cases_case_kind_check
      CHECK (case_kind IN ('acquisition', 'delivery', 'recovery', 'buyer_meetup'));
  ELSE
    RAISE NOTICE 'Existing sourcing cases preserved; case-kind check unchanged.';
  END IF;
END $$;

COMMIT;
