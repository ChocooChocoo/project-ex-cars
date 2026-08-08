-- Disable Row Level Security on Phase 5 tables (testing only — re-enable before production)

ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sell_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_terms DISABLE ROW LEVEL SECURITY;
