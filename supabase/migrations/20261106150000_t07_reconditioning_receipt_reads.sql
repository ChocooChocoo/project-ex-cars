BEGIN;

-- The reconditioning panel reads receipt paths through the normal server client, so the same
-- vehicle staff who can read the fund request must be able to read its receipts.
CREATE POLICY "Vehicle staff read reconditioning receipts" ON public.reconditioning_fund_receipts
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE account_id = auth.uid() AND active
      AND role IN ('ceo','head_accountant','mechanic','sales_manager','marketing_specialist')
  ));

COMMIT;
