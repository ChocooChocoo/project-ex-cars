-- T10 Phase 9: the person who received the purchase funds pays the seller. The Marketing Specialist (GCE Visit)
-- or the Confidential Informant (Meet Halfway) requests the funds, the Head Accountant releases them before the
-- inspection, and the requester records the seller paid once the car is cleared. The Head Accountant can still
-- record it.
-- T10 Phase 10: after payment, a car with no issue goes to the Marketing Specialist for posting; a car with an
-- issue (found at inspection, or a hidden issue re-negotiated) goes to reconditioning first: a job for the
-- field case's Mechanic, who sends the per-part table to the Head Accountant for funds.
-- Each part of the reconditioning table also carries a photo of the part.

ALTER TABLE public.reconditioning_parts ADD COLUMN IF NOT EXISTS photo_path TEXT;

CREATE OR REPLACE FUNCTION public.complete_purchase_disbursement(
  p_disbursement_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_request public.disbursement_requests%ROWTYPE;
  v_tx public.transactions%ROWTYPE;
  v_price NUMERIC;
  v_head_accountant BOOLEAN;
  v_mechanic UUID;
  v_has_issue BOOLEAN;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_request FROM public.disbursement_requests
  WHERE id = p_disbursement_id FOR UPDATE;
  IF NOT FOUND OR v_request.purchase_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Purchase disbursement not found.';
  END IF;

  v_head_accountant := EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE account_id = v_actor AND active = true AND role = 'head_accountant'
  );
  IF NOT v_head_accountant AND v_request.requested_by IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Only the person who received the funds, or the Head Accountant, can record the seller paid.';
  END IF;
  IF v_request.status NOT IN ('released', 'received', 'paid') THEN
    RAISE EXCEPTION 'Cannot move from % to paid.', v_request.status;
  END IF;

  SELECT * INTO v_tx FROM public.transactions
  WHERE id = v_request.purchase_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase transaction not found.';
  END IF;
  IF v_tx.transaction_kind = 'sell' AND NOT (
    v_tx.current_state = 'approved'
    OR (v_request.status = 'paid' AND v_tx.current_state = 'completed')
  ) THEN
    RAISE EXCEPTION 'Sell transaction is not waiting for payment.';
  END IF;
  IF v_tx.transaction_kind = 'sell' AND v_request.status <> 'paid' AND NOT EXISTS (
    SELECT 1 FROM public.sell_details WHERE transaction_id = v_tx.id AND cleared_for_payment_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'The car is not cleared for payment yet.';
  END IF;

  UPDATE public.disbursement_requests SET status = 'paid', updated_at = now()
  WHERE id = v_request.id AND status IN ('released', 'received');
  INSERT INTO public.disbursement_events (disbursement_id, event_kind, actor_id, notes)
  SELECT v_request.id, 'paid', v_actor, p_notes
  WHERE NOT EXISTS (
    SELECT 1 FROM public.disbursement_events
    WHERE disbursement_id = v_request.id AND event_kind = 'paid'
  );

  -- Non-selling purchase requests retain their existing payment-only behavior.
  IF v_tx.transaction_kind <> 'sell' THEN RETURN; END IF;

  IF v_tx.current_state = 'approved' THEN
    UPDATE public.transactions
    SET current_state = 'completed', completed_at = now(), flow_status = NULL, review_due_at = NULL
    WHERE id = v_tx.id;
    INSERT INTO public.transaction_status_history (transaction_id, from_state, to_state, actor_id, reason)
    VALUES (v_tx.id, 'approved', 'completed', v_actor, 'Seller paid');
  END IF;

  SELECT agreed_price INTO v_price FROM public.sell_details WHERE transaction_id = v_tx.id;
  INSERT INTO public.notifications (recipient_role, kind, title, body, reference_table, reference_id)
  SELECT 'ceo', 'sell_payment_disbursed', 'Seller payment disbursed',
    'GCE paid ₱' || COALESCE(v_price, 0)::TEXT || ' for a seller''s car.',
    'transactions', v_tx.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE reference_table = 'transactions' AND reference_id = v_tx.id
      AND kind = 'sell_payment_disbursed' AND recipient_role = 'ceo'
  );

  SELECT mechanic_id, inspection_outcome = 'issue_found' INTO v_mechanic, v_has_issue
  FROM public.field_cases
  WHERE transaction_id = v_tx.id AND case_kind = 'acquisition' AND state <> 'cancelled'
  ORDER BY created_at DESC LIMIT 1;
  v_has_issue := COALESCE(v_has_issue, false)
    OR EXISTS (SELECT 1 FROM public.inspection_issue_reports WHERE transaction_id = v_tx.id);

  IF v_has_issue THEN
    UPDATE public.vehicles SET listing_state = 'repairing'
    WHERE id = v_tx.vehicle_id AND listing_state = 'draft';
    IF FOUND THEN
      INSERT INTO public.reconditioning_jobs (vehicle_id, transaction_id, mechanic_id)
      SELECT v_tx.vehicle_id, v_tx.id, v_mechanic
      WHERE NOT EXISTS (
        SELECT 1 FROM public.reconditioning_jobs WHERE vehicle_id = v_tx.vehicle_id AND state <> 'completed'
      );
      INSERT INTO public.notifications (recipient_id, recipient_role, kind, title, body, reference_table, reference_id)
      SELECT v_mechanic, CASE WHEN v_mechanic IS NULL THEN 'mechanic' END, 'reconditioning', 'Bought car needs reconditioning',
        'GCE paid the seller. Photograph each part to repair or replace and send the parts table to the Head Accountant.',
        'vehicles', v_tx.vehicle_id;
    END IF;
  ELSE
    UPDATE public.vehicles SET listing_state = 'awaiting_price_approval'
    WHERE id = v_tx.vehicle_id AND listing_state = 'draft';
    IF FOUND THEN
      INSERT INTO public.notifications (recipient_role, kind, title, body, reference_table, reference_id)
      SELECT 'marketing_specialist', 'sell_vehicle_ready_to_post', 'Bought car ready to post',
        'GCE paid the seller. Add photos, propose a selling price and post the car.', 'transactions', v_tx.id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE reference_table = 'transactions' AND reference_id = v_tx.id
          AND kind = 'sell_vehicle_ready_to_post' AND recipient_role = 'marketing_specialist'
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_purchase_disbursement(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_purchase_disbursement(UUID, TEXT) TO authenticated;
