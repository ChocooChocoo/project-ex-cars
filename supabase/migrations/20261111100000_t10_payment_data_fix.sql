-- T10 Phase 1: clean the rows left by the Buying bugs. Backup taken first: backups/t10-2026-11-11T01-33-58-976Z.json.
--
-- 1. Stuck advance payments: PayMongo sessions the buyer opened and never paid stayed in payment_records as
--    "Waiting for PayMongo" (hosted DB 2026-11-11: 2 rows on the Mitsubishi Mirage G4 sale). PayMongo expires a
--    session after 24 hours, so an unpaid session row older than a day can never be paid; it is removed.
-- 2. Financed cars still in the showroom: a car held by a financing buyer was left "available"
--    (hosted DB: the Mirage G4). It is reserved, as the app now does when the claim or account opens.
--
-- The "doubled" December 10 payment was one Advanced Payment covering installments #1 (due 2026-12-10) and
-- #2 (due 2027-01-10): two rows, one PayMongo payment, no duplicate. The payment tables now name the installment.

BEGIN;

DELETE FROM public.payment_records
WHERE paymongo_checkout_id IS NOT NULL
  AND paymongo_payment_id IS NULL
  AND paid_at IS NULL
  AND verified_by IS NULL
  AND rejected_at IS NULL
  AND created_at < now() - interval '1 day';

UPDATE public.vehicles v
SET listing_state = 'reserved'
WHERE v.listing_state = 'available'
  AND EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.vehicle_id = v.id
      AND t.transaction_kind = 'buy'
      AND t.current_state = 'approved'
      AND t.flow_status IN ('purchase_claim', 'initial_dp_awaiting_verification', 'initial_dp_confirmed', 'financing_active')
  );

COMMIT;
