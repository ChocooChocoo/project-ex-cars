-- 00044: Task 32 — sell-document visibility for field roles + approval gate data
-- Additive SELECT policies only. Mechanics and Confidential Informants need to
-- SEE sell photos (sell_photo) and the condition checklist on sell_details to
-- prioritize inspection, per the client requirement. No write broadening.

-- Mechanics + CI can read sell_details rows (read-only; manage stays ceo/sales_manager).
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Field roles can read sell details' AND tablename = 'sell_details') THEN
  CREATE POLICY "Field roles can read sell details"
    ON public.sell_details FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM private.user_roles
        WHERE account_id = auth.uid() AND active = true
        AND role IN ('mechanic', 'confidential_informant', 'head_accountant')
      )
    );
END IF; END $$;

-- Mechanics + CI can read sell_photo transaction documents (read-only).
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Field roles can read sell photos' AND tablename = 'transaction_documents') THEN
  CREATE POLICY "Field roles can read sell photos"
    ON public.transaction_documents FOR SELECT
    USING (
      document_kind = 'sell_photo'
      AND EXISTS (
        SELECT 1 FROM private.user_roles
        WHERE account_id = auth.uid() AND active = true
        AND role IN ('mechanic', 'confidential_informant')
      )
    );
END IF; END $$;

-- Field roles can read sell-photo objects in private storage. Paths are stored
-- as {transactionId}/sell-photo-*.{ext}, i.e. two folder segments, matching
-- the (storage.foldername(name))[1] convention used in 00024/00028.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Field roles can read sell photos' AND tablename = 'objects') THEN
  CREATE POLICY "Field roles can read sell photos" ON storage.objects
    FOR SELECT USING (
      bucket_id = 'transaction-documents'
      AND name LIKE '%/sell-photo-%.%'
      AND EXISTS (
        SELECT 1 FROM private.user_roles
        WHERE account_id = auth.uid() AND active = true
        AND role IN ('mechanic', 'confidential_informant')
      )
    );
END IF; END $$;
