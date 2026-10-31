-- T06: leave reasons, proof files, and the request insert/update guard.
-- Before this migration a staff member could insert or update their own request through PostgREST
-- with status = 'approved' and reviewed_by = someone else, because the policies only checked the owner.

ALTER TABLE public.employee_requests
  ADD COLUMN IF NOT EXISTS leave_reason TEXT;

ALTER TABLE public.employee_requests
  ADD CONSTRAINT chk_employee_request_leave_reason
    CHECK (
      leave_reason IS NULL
      OR leave_reason IN ('sick', 'vacation', 'emergency', 'bereavement', 'maternity_paternity', 'others')
    );

ALTER TABLE public.employee_requests
  ALTER COLUMN reason DROP NOT NULL;

-- Legacy leave rows have no dropdown reason. A NOT VALID check is still enforced on later updates, so
-- reviewing or cancelling one would fail; file their free text under Others before the check exists.
UPDATE public.employee_requests
SET leave_reason = 'others',
    reason = COALESCE(NULLIF(btrim(reason), ''), 'Reason not recorded')
WHERE request_kind = 'leave'
  AND leave_reason IS NULL;

-- New leave rows need a reason, and Others needs the typed explanation. NOT VALID keeps the migration
-- from scanning the existing table; the backfill above already made every legacy row pass.
ALTER TABLE public.employee_requests
  ADD CONSTRAINT chk_employee_request_leave_reason_required
    CHECK (
      request_kind <> 'leave'
      OR (
        leave_reason IS NOT NULL
        AND (leave_reason <> 'others' OR NULLIF(btrim(reason), '') IS NOT NULL)
      )
    ) NOT VALID;

DROP POLICY IF EXISTS "Staff can insert own requests" ON public.employee_requests;
CREATE POLICY "Staff can insert own requests"
  ON public.employee_requests FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid() AND status = 'pending' AND reviewed_by IS NULL);

DROP POLICY IF EXISTS "Staff can update own pending requests" ON public.employee_requests;
CREATE POLICY "Staff can update own pending requests"
  ON public.employee_requests FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid() AND status = 'pending')
  WITH CHECK (employee_id = auth.uid() AND status IN ('pending', 'cancelled'));

-- Proof files for a request. The app uploads browser -> storage on a signed URL inside the caller's
-- folder and records each row with the admin client, so there is no INSERT policy here.
CREATE TABLE IF NOT EXISTS public.employee_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.employee_requests(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_kind TEXT NOT NULL DEFAULT 'file' CHECK (file_kind IN ('image', 'file')),
  file_size INTEGER CHECK (file_size >= 0),
  uploader_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_request_attachments_request
  ON public.employee_request_attachments(request_id);

ALTER TABLE public.employee_request_attachments ENABLE ROW LEVEL SECURITY;

-- The subquery runs under the caller's own employee_requests rules: own row, or CEO/Account Manager.
DROP POLICY IF EXISTS "Request owner and reviewers can read attachments" ON public.employee_request_attachments;
CREATE POLICY "Request owner and reviewers can read attachments"
  ON public.employee_request_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_requests AS r
      WHERE r.id = employee_request_attachments.request_id
      AND (
        r.employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM private.user_roles AS ur
          WHERE ur.account_id = auth.uid()
          AND ur.active = true
          AND ur.role IN ('ceo', 'account_manager')
        )
      )
    )
  );

-- Private bucket, same limits as the chat attachments. The server signs upload and download URLs
-- after checking the request, so no storage.objects policy is needed for browsers.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'request-attachments',
  'request-attachments',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
