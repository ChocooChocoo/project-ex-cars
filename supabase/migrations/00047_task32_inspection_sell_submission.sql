-- 00047: Task 32 — narrow sell-submission bridge for inspection field roles

CREATE OR REPLACE FUNCTION public.get_inspection_sell_submission(inspection_id UUID)
RETURNS TABLE (transaction_id UUID, condition_items JSONB)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT transaction.id, sell.condition_items
  FROM public.vehicle_inspections AS inspection
  JOIN public.transactions AS transaction ON transaction.vehicle_id = inspection.vehicle_id
  JOIN public.sell_details AS sell ON sell.transaction_id = transaction.id
  WHERE inspection.id = inspection_id
    AND transaction.transaction_kind = 'sell'
    AND EXISTS (
      SELECT 1
      FROM private.user_roles AS actor
      WHERE actor.account_id = auth.uid()
        AND actor.active = true
        AND (
          (actor.role = 'mechanic' AND inspection.mechanic_id = auth.uid())
          OR actor.role = 'confidential_informant'
        )
    )
  ORDER BY transaction.opened_at DESC, transaction.created_at DESC, transaction.id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_inspection_sell_submission(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inspection_sell_submission(UUID) TO authenticated;
