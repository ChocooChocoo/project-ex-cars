-- T04 Phase 9 (client change requests batch 2, S3): interior photos are their own media kind,
-- so the showroom can show them in a separate Interior tab.

ALTER TABLE public.vehicle_media DROP CONSTRAINT IF EXISTS vehicle_media_media_kind_check;
ALTER TABLE public.vehicle_media
  ADD CONSTRAINT vehicle_media_media_kind_check
  CHECK (media_kind IN ('photo', '360_view', 'interior'));
