-- T06 reviewer changes: GCE's financing profit (10% on top of the car's price) becomes adjustable.
-- Business settings live in one key/value table. Everyone can read them, because the public financing
-- estimator shows the markup; only the CEO and the Super Admin can change them.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  -- audit_events.record_id is a UUID, so each setting carries one.
  id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users (id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
CREATE POLICY "Anyone can read app settings"
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "CEO and Super Admin can update app settings" ON public.app_settings;
CREATE POLICY "CEO and Super Admin can update app settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role IN ('ceo', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private.user_roles ur
      WHERE ur.account_id = auth.uid() AND ur.active = true AND ur.role IN ('ceo', 'super_admin')
    )
  );

INSERT INTO public.app_settings (key, value)
VALUES ('financing_markup_pct', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;
