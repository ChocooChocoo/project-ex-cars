-- T05 Phase 4 (client change requests batch 3): Record Payment accepts one submission per payment kind.
-- A payment is recorded once, then the Head Accountant verifies or rejects it. A second live row of the
-- same kind would count twice toward what the buyer paid, so the database refuses it.
--
-- The index is partial on purpose:
--   * a rejected row frees its kind, so the Sales Manager can record the corrected payment;
--   * installment rows are told apart by installment_id, not by kind (every month is "balance" or none);
--   * the reschedule fee can be charged again when a delivery is moved a second time.
--
-- Pre-check (2026-10-31): the hosted dev database was queried for duplicate live rows per
-- (transaction_id, payment_kind). Six duplicate groups were found, the user approved a soft-reject
-- cleanup, and 0 groups remain. This migration therefore needs no data change.

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_once_per_kind
  ON public.payment_records (transaction_id, payment_kind)
  WHERE installment_id IS NULL
    AND rejected_at IS NULL
    AND payment_kind <> 'reschedule_fee';
