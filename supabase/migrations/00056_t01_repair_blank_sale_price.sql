-- 00056: T01 Scenario 3 data repair
-- 1. A blank Final Price was saved as 0, so the sale showed ₱0 to staff and the buyer and a blank
--    Sale price in Finance. saveBuyDetails now falls back to the Showroom price; this repairs the
--    rows already written.
-- 2. A Proof of Billing uploaded after a valid ID kept that ID's type. Only valid IDs carry one.

UPDATE public.purchase_details pd
SET final_price = v.current_price
FROM public.transactions t
JOIN public.vehicles v ON v.id = t.vehicle_id
WHERE pd.transaction_id = t.id
  AND COALESCE(pd.final_price, 0) = 0
  AND v.current_price > 0;

UPDATE public.transaction_documents
SET id_type = NULL
WHERE document_kind <> 'valid_id' AND id_type IS NOT NULL;
