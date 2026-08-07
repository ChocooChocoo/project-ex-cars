-- Phase 3: Conversations Stay Together
-- Tables: inquiries, inquiry_messages, viewing_arrangements, message_attachments, message_reports

-- 1. Inquiries
CREATE TABLE public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  intention_kind TEXT NOT NULL CHECK (intention_kind IN ('inquiry', 'buy_now')),
  assigned_account_manager UUID REFERENCES auth.users(id),
  assigned_sales_manager UUID REFERENCES auth.users(id),
  handoff_state TEXT NOT NULL DEFAULT 'none' CHECK (handoff_state IN ('none', 'pending_handoff', 'handed_off')),
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'assigned', 'scheduled', 'handed_off', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inquiries_customer ON public.inquiries(customer_id);
CREATE INDEX idx_inquiries_account_manager ON public.inquiries(assigned_account_manager, state);
CREATE INDEX idx_inquiries_sales_manager ON public.inquiries(assigned_sales_manager, state);
CREATE INDEX idx_inquiries_state ON public.inquiries(state);

CREATE TRIGGER inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Inquiry Messages
CREATE TABLE public.inquiry_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message_text TEXT,
  image_path TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_inquiry ON public.inquiry_messages(inquiry_id, sent_at);

-- 3. Viewing Arrangements
CREATE TABLE public.viewing_arrangements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  purchase_transaction_id UUID,
  arrangement_kind TEXT NOT NULL CHECK (arrangement_kind IN ('delivery', 'meetup', 'gce_visit')),
  schedule TIMESTAMPTZ NOT NULL,
  location TEXT,
  down_payment_amount NUMERIC(12,2) CHECK (down_payment_amount >= 0),
  confirmation_state TEXT NOT NULL DEFAULT 'pending' CHECK (confirmation_state IN ('pending', 'confirmed', 'completed', 'cancelled')),
  confirmed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_arrangements_inquiry ON public.viewing_arrangements(inquiry_id);

-- 4. Message Attachments
CREATE TABLE public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.inquiry_messages(id) ON DELETE CASCADE,
  file_kind TEXT NOT NULL DEFAULT 'file' CHECK (file_kind IN ('image', 'file')),
  storage_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size INTEGER CHECK (file_size >= 0),
  uploader_id UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_message ON public.message_attachments(message_id);

-- 5. Message Reports
CREATE TABLE public.message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_message_id UUID REFERENCES public.inquiry_messages(id) ON DELETE SET NULL,
  reported_inquiry_id UUID REFERENCES public.inquiries(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'reviewed', 'upheld', 'dismissed')),
  reviewer_id UUID REFERENCES auth.users(id),
  decision_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_state ON public.message_reports(state);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Inquiries
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own inquiries"
  ON public.inquiries FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Customers can create inquiries"
  ON public.inquiries FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Account Manager can read all inquiries"
  ON public.inquiries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'account_manager'
    )
  );

CREATE POLICY "Sales Manager can read buy_now inquiries"
  ON public.inquiries FOR SELECT
  USING (
    intention_kind = 'buy_now' AND
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'sales_manager'
    )
  );

CREATE POLICY "Staff can update assigned inquiries"
  ON public.inquiries FOR UPDATE
  USING (
    (assigned_account_manager = auth.uid() OR assigned_sales_manager = auth.uid())
    OR EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "CEO can read all inquiries"
  ON public.inquiries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role = 'ceo'
    )
  );

-- Inquiry Messages
ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read messages"
  ON public.inquiry_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inquiries
      WHERE id = inquiry_messages.inquiry_id
      AND (customer_id = auth.uid() OR assigned_account_manager = auth.uid() OR assigned_sales_manager = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "Participants can send messages"
  ON public.inquiry_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.inquiries
      WHERE id = inquiry_messages.inquiry_id
      AND (customer_id = auth.uid() OR assigned_account_manager = auth.uid() OR assigned_sales_manager = auth.uid())
    )
  );

-- Viewing Arrangements
ALTER TABLE public.viewing_arrangements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read arrangements"
  ON public.viewing_arrangements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inquiries
      WHERE id = viewing_arrangements.inquiry_id
      AND (customer_id = auth.uid() OR assigned_account_manager = auth.uid() OR assigned_sales_manager = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "Staff can manage arrangements"
  ON public.viewing_arrangements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.inquiries
      WHERE id = viewing_arrangements.inquiry_id
      AND (assigned_account_manager = auth.uid() OR assigned_sales_manager = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager')
    )
  );

-- Message Attachments
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read attachments"
  ON public.message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inquiry_messages m
      JOIN public.inquiries i ON i.id = m.inquiry_id
      WHERE m.id = message_attachments.message_id
      AND (i.customer_id = auth.uid() OR i.assigned_account_manager = auth.uid() OR i.assigned_sales_manager = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "Participants can upload attachments"
  ON public.message_attachments FOR INSERT
  WITH CHECK (
    uploader_id = auth.uid()
  );

-- Message Reports
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can create reports"
  ON public.message_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Staff can read reports"
  ON public.message_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager')
    )
  );

CREATE POLICY "Staff can update reports"
  ON public.message_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM private.user_roles
      WHERE account_id = auth.uid() AND active = true
      AND role IN ('ceo', 'account_manager')
    )
  );

-- Enable Realtime for messages (run manually in Supabase dashboard or via management API)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiry_messages;
