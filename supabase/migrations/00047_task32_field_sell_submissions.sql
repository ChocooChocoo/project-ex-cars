-- 00047: Task 32 — read-only sell-submission list for the field roles
--
-- The mechanic and the Confidential Informant must be able to look at the photos and the
-- condition checklist a customer sent with a car. 00044 already granted both roles row read
-- on sell_details, on transaction_documents where document_kind = 'sell_photo', and on the
-- matching storage objects — but `transactions` has no SELECT policy for either role, and a
-- submission reaches its vehicle only through `transactions.vehicle_id`. So the granted rows
-- could never be tied to a car, and an inspection-side join finds nothing: every inspection
-- in the database is on an inventory vehicle bought by GCE, never on a customer's own
-- SELL- submission.
--
-- This exposes exactly the list the field roles need: which sell submissions exist, the car
-- each one concerns, and the checklist the customer ticked. The commercial side of the offer
-- (offered_amount, valuation_amount, review_notes, decision, decision_maker_id) is
-- deliberately NOT returned — seeing the photos does not require seeing the negotiation.
-- Write access and the transaction list stay exactly as they were.

CREATE OR REPLACE FUNCTION public.list_field_sell_submissions()
RETURNS TABLE (
  transaction_id UUID,
  current_state TEXT,
  opened_at TIMESTAMPTZ,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_stock_code TEXT,
  condition_items JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT transaction.id,
         transaction.current_state,
         transaction.opened_at,
         vehicle.make,
         vehicle.model,
         vehicle.year,
         vehicle.stock_code,
         COALESCE(sell.condition_items, '[]'::jsonb)
  FROM public.transactions AS transaction
  JOIN public.sell_details AS sell ON sell.transaction_id = transaction.id
  LEFT JOIN public.vehicles AS vehicle ON vehicle.id = transaction.vehicle_id
  WHERE transaction.transaction_kind = 'sell'
    AND EXISTS (
      SELECT 1
      FROM private.user_roles AS actor
      WHERE actor.account_id = auth.uid()
        AND actor.active = true
        AND actor.role IN ('mechanic', 'confidential_informant')
    )
  ORDER BY transaction.opened_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_field_sell_submissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_field_sell_submissions() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_field_sell_submissions() TO authenticated;
