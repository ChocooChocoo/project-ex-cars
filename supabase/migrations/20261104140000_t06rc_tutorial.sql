-- T06 reviewer changes: a new account sees a step-by-step tutorial once. Accounts that exist before this
-- migration have already used the system, so they are marked as done.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_completed_at TIMESTAMPTZ;

UPDATE public.profiles SET tutorial_completed_at = now() WHERE tutorial_completed_at IS NULL;
