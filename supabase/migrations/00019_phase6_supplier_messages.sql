-- 00019: Phase 6 — Supplier Messages (conditional on Q-23 approval)
-- Only linked approved supplier and CEO can participate.

CREATE TABLE IF NOT EXISTS public.supplier_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message_text TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_messages ENABLE ROW LEVEL SECURITY;

-- Only the linked approved supplier and CEO can read
CREATE POLICY "Linked supplier can read own messages" ON public.supplier_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_id
      AND s.account_id = auth.uid()
      AND s.state = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
      AND active = true AND role = 'ceo'
    )
  );

-- Only approved supplier or CEO can send
CREATE POLICY "Approved supplier or CEO can send messages" ON public.supplier_messages
  FOR INSERT WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.suppliers s
        WHERE s.id = supplier_id
        AND s.account_id = auth.uid()
        AND s.state = 'approved'
      )
      OR EXISTS (
        SELECT 1 FROM private.user_roles WHERE account_id = auth.uid()
        AND active = true AND role = 'ceo'
      )
    )
    AND sender_id = auth.uid()
  );

-- Enable Realtime for supplier messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_messages;
