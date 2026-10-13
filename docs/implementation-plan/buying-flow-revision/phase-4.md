[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)

**Status:** 🔲 Not Started

# Phase 4: Scenario flow changes (S2, S4/S5, S8, S9, chat)

**Goal:** each scenario follows the client doc's step order, including the reordered financing meet-up and
financing delivery.

## Tasks

- [x] Financing terms chain Sales Manager, Head Accountant, CEO: `src/app/(staff)/transactions/financing-actions.ts`.
- [x] Financing with a meet-up or delivery arrangement: `isFinancingRequest` in `src/lib/transactions/buy-flow.ts`, `respondToFinancingOffer` in `src/app/(customer)/my-transactions/actions.ts`.
- [x] Delivery team and field case: `createDeliveryFieldCase` in `src/app/(staff)/transactions/delivery-actions.ts`.
- [ ] Migration `supabase/migrations/00059_t01_scenario_flow_fields.sql`: `payment_terms.monthly_payment`, `missed_payment_policy`, `delivery_fee`; `purchase_details.requested_term_months`, `delivery_terms_agreed_at`; `inquiries.intention_kind` += `buy_financing`.
- [ ] Scenario 2: after Approve, the Sales Manager must choose a CI and a Mechanic; create the `buyer_meetup` field case with the worker check from `createDeliveryFieldCase`; add `receiveFieldCase` for both.
- [ ] Scenarios 4 and 5: `proposeFinancingTerms` requires `monthly_payment` and `missed_payment_policy`; fields in `financing-panel.tsx`.
- [ ] Scenario 8: term picker (1, 2, 3, 5 years) with the monthly amount in the customer `transaction-detail.tsx`; no downpayment on meet-up terms; team assigned only after contract approval and booking; `completeFinancingAgreement` requires `signing_reported_at` instead of a confirmed downpayment; Mark as Sold skips the payment-record check for this case.
- [ ] Scenario 9: the buyer picks the delivery date and clicks **I agree** at request; `proposeFinancingTerms` takes the delivery fee; `confirmFinancingTerms` writes the fee, the downpayment and the 3-working-day deadline and sends the breakdown (replaces `setDeliveryTerms` for financing); `completeFinancingAgreement` requires delivered plus `signing_reported_at`.
- [ ] Scenario 3: delivery terms notice with **I agree** before submit.
- [ ] Chat: create a `buy_financing` inquiry thread on financing submit (same pattern as the sell negotiation thread in `submitSellVehicle`); link it from the staff and customer request pages.

## Dependencies

- Phase 3.
- Migration 00059 applied to the hosted Supabase project (needs the owner's confirmation).

## Done when

- [ ] Scenario 2: approval without a CI or a Mechanic is refused.
- [ ] Scenario 8: no Initial Downpayment field; Complete financing agreement is offered only after the CI reports the signing; the buyer page shows ₱500,000 as both Vehicle Price and Amount Financed.
- [ ] Scenario 9: terms cannot be sent without the fee, the downpayment or the missed payment policy; the CEO's confirmation sends the breakdown.
- [ ] The Sales Manager and the buyer can chat on a financing request.

[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)
