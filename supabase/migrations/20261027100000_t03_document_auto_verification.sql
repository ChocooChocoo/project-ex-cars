-- T03 Phase 10 (C11, SM2): result of the automatic OR/CR and ID check.
-- The check is advisory; staff Verify / Ask to resubmit stays the final decision.
-- Timestamped name so it runs after every existing migration on a fresh reset.

ALTER TABLE public.transaction_documents
  ADD COLUMN IF NOT EXISTS auto_check_status TEXT
    CHECK (auto_check_status IN ('verified', 'failed', 'manual_review')),
  ADD COLUMN IF NOT EXISTS auto_check_provider TEXT,
  ADD COLUMN IF NOT EXISTS auto_check_detail TEXT,
  ADD COLUMN IF NOT EXISTS auto_checked_at TIMESTAMPTZ;

-- Only the server (service role) writes the result. Browser sessions cannot set or change it,
-- so a customer cannot upload a document already marked "Auto-check: verified".
CREATE OR REPLACE FUNCTION public.guard_document_auto_check()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.auto_check_status := NULL;
      NEW.auto_check_provider := NULL;
      NEW.auto_check_detail := NULL;
      NEW.auto_checked_at := NULL;
    ELSE
      NEW.auto_check_status := OLD.auto_check_status;
      NEW.auto_check_provider := OLD.auto_check_provider;
      NEW.auto_check_detail := OLD.auto_check_detail;
      NEW.auto_checked_at := OLD.auto_checked_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_document_auto_check ON public.transaction_documents;
CREATE TRIGGER guard_document_auto_check
  BEFORE INSERT OR UPDATE ON public.transaction_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_document_auto_check();
