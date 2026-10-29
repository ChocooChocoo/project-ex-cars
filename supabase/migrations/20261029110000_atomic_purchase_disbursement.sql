-- Payment recording and its selling handoff must either all commit or all roll back.
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
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM private.user_roles
    WHERE account_id = v_actor AND active = true AND role = 'head_accountant'
  ) THEN
    RAISE EXCEPTION 'Only the Head Accountant can mark car-purchase funds paid.';
  END IF;

  SELECT * INTO v_request FROM public.disbursement_requests
  WHERE id = p_disbursement_id FOR UPDATE;
  IF NOT FOUND OR v_request.purchase_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Purchase disbursement not found.';
  END IF;
  IF v_request.status NOT IN ('received', 'paid') THEN
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

  UPDATE public.disbursement_requests SET status = 'paid', updated_at = now()
  WHERE id = v_request.id AND status = 'received';
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
    VALUES (v_tx.id, 'approved', 'completed', v_actor, 'Seller paid by the Head Accountant');
  END IF;

  SELECT agreed_price INTO v_price FROM public.sell_details WHERE transaction_id = v_tx.id;
  INSERT INTO public.notifications (recipient_role, kind, title, body, reference_table, reference_id)
  SELECT 'ceo', 'sell_payment_disbursed', 'Seller payment disbursed',
    'The Head Accountant paid ₱' || COALESCE(v_price, 0)::TEXT || ' for a seller''s car.',
    'transactions', v_tx.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE reference_table = 'transactions' AND reference_id = v_tx.id
      AND kind = 'sell_payment_disbursed' AND recipient_role = 'ceo'
  );

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
END;
$$;

REVOKE ALL ON FUNCTION public.complete_purchase_disbursement(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_purchase_disbursement(UUID, TEXT) TO authenticated;
