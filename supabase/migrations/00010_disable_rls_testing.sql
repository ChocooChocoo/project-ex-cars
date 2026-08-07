-- Disable Row Level Security on all tables (testing only — re-enable before production)

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_media DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_inspections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.repairs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_price_proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_checklist_nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_checklist_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_replacements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_document_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_arrangements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_feedback DISABLE ROW LEVEL SECURITY;
