-- 00045: Task 33 — workflow permissions and document-check consistency
-- Keeps arrangement access scoped to the related inquiry or purchase transaction,
-- replaces the broad customer document insert with per-kind guards, and narrows the
-- Head Accountant metadata insert to what the upload flow actually performs.

ALTER TABLE public.viewing_arrangements
  ALTER COLUMN inquiry_id DROP NOT NULL;

-- Customers may create arrangements for their own buy transactions.  The
-- purchase_transaction_id link is intentional: customer-created arrangements
-- do not need an inquiry row and must not depend on inquiry_id being present.
-- Requiring inquiry_id IS NULL keeps a customer from attaching an arrangement to
-- another customer's inquiry, which existing inquiry-participant policies would
-- then expose to that inquiry's participants.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Customers can create own transaction arrangements'
      AND tablename = 'viewing_arrangements'
  ) THEN
    CREATE POLICY "Customers can create own transaction arrangements"
      ON public.viewing_arrangements
      FOR INSERT
      TO authenticated
      WITH CHECK (
        inquiry_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.transactions
          WHERE transactions.id = viewing_arrangements.purchase_transaction_id
            AND transactions.customer_id = auth.uid()
            AND transactions.transaction_kind = 'buy'
        )
      );
  END IF;
END $$;

-- Customers may read arrangements linked to their own transactions.  Existing
-- inquiry-participant and assigned-staff policies remain in force alongside it.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Customers can read own transaction arrangements'
      AND tablename = 'viewing_arrangements'
  ) THEN
    CREATE POLICY "Customers can read own transaction arrangements"
      ON public.viewing_arrangements
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.transactions
          WHERE transactions.id = viewing_arrangements.purchase_transaction_id
            AND transactions.customer_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Head Accountants may upload transaction-document objects, but only into an
-- existing transaction folder.  This is INSERT-only; no update/delete access
-- is added here.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Head Accountant can upload transaction documents'
      AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Head Accountant can upload transaction documents"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'transaction-documents'
        AND EXISTS (
          SELECT 1
          FROM public.transactions
          WHERE transactions.id = (storage.foldername(name))[1]::uuid
        )
        AND EXISTS (
          SELECT 1
          FROM private.user_roles
          WHERE account_id = auth.uid()
            AND active = true
            AND role = 'head_accountant'
        )
      );
  END IF;
END $$;

-- Permit the matching metadata row insert for the same role.  The uploader
-- remains the authenticated Head Accountant; the row must land in a transaction
-- folder, and a prerequisite kind (valid_id / proof_of_billing) is only accepted
-- as an unverified 'pending' record on a buy transaction, so no upload can arrive
-- pre-verified and no prerequisite can be recorded against sell/request records.
-- The same role's existing staff manage policy still governs later changes.
DROP POLICY IF EXISTS "Head Accountant can upload transaction document records"
  ON public.transaction_documents;

CREATE POLICY "Head Accountant can upload transaction document records"
  ON public.transaction_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM private.user_roles
      WHERE account_id = auth.uid()
        AND active = true
        AND role = 'head_accountant'
    )
    AND EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE transactions.id = transaction_documents.transaction_id
        AND (
          transaction_documents.document_kind NOT IN ('valid_id', 'proof_of_billing')
          OR (
            transactions.transaction_kind = 'buy'
            AND transaction_documents.verification_state = 'pending'
          )
        )
    )
    AND (
      storage_path IS NULL
      OR storage_path LIKE transaction_documents.transaction_id::text || '/%'
    )
  );

-- The 00011 policy let any authenticated user insert any document row for any
-- transaction, because it only checked uploader_id = auth.uid().  Postgres ORs
-- INSERT policies, so it has to go rather than be tightened in place: it also
-- allowed a customer to forge verification_state = 'verified' rows for a
-- transaction they do not own and skip the Head Accountant / CEO gate.  Two
-- narrower per-kind policies replace it.
DROP POLICY IF EXISTS "Customers can upload documents" ON public.transaction_documents;

-- Purchase paperwork: the customer's own buy transaction, prerequisite kinds
-- only, and always inserted pending so verification cannot be forged.
DROP POLICY IF EXISTS "Customers can upload own purchase documents" ON public.transaction_documents;

CREATE POLICY "Customers can upload own purchase documents"
  ON public.transaction_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND document_kind IN ('valid_id', 'proof_of_billing')
    AND verification_state = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE transactions.id = transaction_documents.transaction_id
        AND transactions.customer_id = auth.uid()
        AND transactions.transaction_kind = 'buy'
    )
    AND (
      storage_path IS NULL
      OR storage_path LIKE transaction_documents.transaction_id::text || '/%'
    )
  );

-- Sell photos: the customer's own sell transaction.  These are attachments, not
-- prerequisites, so they are recorded verified by the sell-vehicle flow and stay
-- outside the Head Accountant / CEO approval gate.
DROP POLICY IF EXISTS "Customers can upload own sell photos" ON public.transaction_documents;

CREATE POLICY "Customers can upload own sell photos"
  ON public.transaction_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND document_kind = 'sell_photo'
    AND verification_state = 'verified'
    AND EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE transactions.id = transaction_documents.transaction_id
        AND transactions.customer_id = auth.uid()
        AND transactions.transaction_kind = 'sell'
    )
    AND (
      storage_path IS NULL
      OR storage_path LIKE transaction_documents.transaction_id::text || '/%'
    )
  );
