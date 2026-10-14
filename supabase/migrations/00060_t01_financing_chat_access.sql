-- 00060: T01 buying-flow revision, Phase 4 — the Sales Manager in a financing request's chat thread
-- 00059 allowed 'buy_financing' threads. The Sales Manager's policies (00005) cover only 'buy_now'
-- inquiries and messages of threads assigned to him, so he could neither open nor answer a financing
-- thread. These mirror the Marketing Specialist's sell negotiation policies (00049).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Sales Manager can read financing threads' AND tablename = 'inquiries'
  ) THEN
    CREATE POLICY "Sales Manager can read financing threads"
      ON public.inquiries FOR SELECT
      TO authenticated
      USING (
        intention_kind = 'buy_financing'
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'sales_manager'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Sales Manager can read financing thread messages' AND tablename = 'inquiry_messages'
  ) THEN
    CREATE POLICY "Sales Manager can read financing thread messages"
      ON public.inquiry_messages FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.inquiries
          WHERE inquiries.id = inquiry_messages.inquiry_id
            AND inquiries.intention_kind = 'buy_financing'
        )
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'sales_manager'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Sales Manager can send financing thread messages' AND tablename = 'inquiry_messages'
  ) THEN
    CREATE POLICY "Sales Manager can send financing thread messages"
      ON public.inquiry_messages FOR INSERT
      TO authenticated
      WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.inquiries
          WHERE inquiries.id = inquiry_messages.inquiry_id
            AND inquiries.intention_kind = 'buy_financing'
        )
        AND EXISTS (
          SELECT 1 FROM private.user_roles
          WHERE account_id = auth.uid() AND active = true AND role = 'sales_manager'
        )
      );
  END IF;
END $$;
