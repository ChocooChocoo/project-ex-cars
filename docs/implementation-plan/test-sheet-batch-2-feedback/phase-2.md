[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)

**Status:** 🟡 In progress

> 2026-10-31: Implementation done. `BUYER_PAYMENT_METHODS` and `PURCHASE_PAYMENT_METHODS` are split out of the
> `payment_records` list, and `paymongo` stays the channel. The new migration moves old purchase rows and narrows the
> `purchase_details` CHECK. `onlinePaymentsDue` returns the Bank Transfer downpayment before signing and the
> remaining balance after. The buyer button reads "Pay by bank transfer (PayMongo)", and staff Record Payment hides
> Bank Transfer for a Bank Transfer buy. Verified with 95 tests across six files, `npx tsc --noEmit`, and
> `npx biome check` on the touched files. Live PayMongo checkout and Playwright QA are deferred to the main agent.

# Phase 2: Bank Transfer through PayMongo

**Goal:** For Full Payment, the payment methods are Cash and Bank Transfer (via PayMongo). A Bank Transfer buyer pays
online through PayMongo checkout, and the webhook records the payment as verified.

Source: client answer on batch 2 test 4 (Payment Option and Payment Method): "sir bat kasama yung paymongo sa payment
method ang tinutukoy po namin dun is yung bank transfer sa paymongo mag babayad sir". In English: PayMongo should not
be its own payment method; Bank Transfer is paid through PayMongo.

Decision (2026-10-31):
- Bank Transfer = PayMongo online checkout.
- The `paymongo` buyer option is removed.
- Old `purchase_details` rows with `paymongo` are migrated to `bank_transfer`.

Today, PayMongo checkout (`src/lib/payments/paymongo.ts`, `METHODS = ["card","gcash","paymaya","dob"]`) is used only
for what `onlinePaymentsDue` returns (`buy-flow.ts:332-353`): the delivery fee plus downpayment, or a financing
downpayment. The full price is never paid online. `src/lib/payments/checkout-paid.ts` already sets `verified_by` on
paid rows.

Overlap: `client-change-requests-batch-3/phase-4.md` (`nextDuePayment`, Record Payment) touches the same payment
code. Do this phase first, or rebase that phase on it.

## Dependencies

- Phase 1, so the buy flow can be tested end to end.

## Tasks

- [x] Split the method lists:
  - New `BUYER_PAYMENT_METHODS = ["cash", "bank_transfer"]` for `purchase_details`. Financing stays a Payment Option.
  - `PAYMENT_METHODS` (`src/lib/transactions/state-machine.ts:18`) keeps `paymongo` as the `payment_records.method`
    channel. `startOnlinePayment` writes that value (`my-transactions/actions.ts:944`).
  - Update `DIRECT_PAYMENT_METHODS` (`buy-flow.ts:14`) and `buyDetailsSchema` (`src/lib/validation/transactions.ts:18`).
- [x] Migration `supabase/migrations/<timestamp>_t06_bank_transfer_paymongo.sql` (+ `.test.ts`):
  - Update `purchase_details.payment_method` from `'paymongo'` to `'bank_transfer'`.
  - Replace the `purchase_details` CHECK without `paymongo`.
  - Leave the `payment_records` CHECK unchanged.
  - Update `20261028100000_t04_payment_option.test.ts:32-40` to the split lists.
- [x] `onlinePaymentsDue` (`buy-flow.ts:332-353`) for `bank_transfer`:
  - Before the contract is signed, return the downpayment, when `paymentAllowedBeforeSigning` allows it.
  - After the contract is signed, return the remaining balance (price minus verified payments).
  - Write the tests per arrangement (GCE Visit, CALABARZON Meet-up, Delivery) first.

  > 2026-10-31: a bank-transfer delivery still has its fee and downpayment due before signing, matching the delivery
  > terms the buyer already agrees to. A bank-transfer GCE visit has no contract, so its full price is due online.
  > Assumption for live QA: nothing in the app writes `downpayment_amount` for a cash or Bank Transfer meet-up yet;
  > the meet-up downpayment case needs that amount set (seed or a later phase) before PayMongo can charge it.
- [x] `startOnlinePayment` (`my-transactions/actions.ts:853-959`) and `my-transactions/_components/online-payment.tsx`:
  label the button "Pay by bank transfer (PayMongo)". Confirm the Mark Sold gate (`src/app/(staff)/transactions/actions.ts:155-172`)
  passes on PayMongo-verified rows.

  > 2026-10-31: the gate already reads `verified_by` for a Bank Transfer buy, and `checkout-paid.ts` sets it, so no
  > change was needed. Not exercised against live PayMongo; deferred to the main agent.
- [x] Staff Record Payment (`transactions/[id]/_components/transaction-detail-sidebar-v1.tsx:322-323`): remove the
  manual `bank_transfer` option for buys whose method is `bank_transfer`. Cash and financing installments are
  unchanged.
- [x] Update the text that mentions payment methods:
  - `src/lib/transactions/labels.ts:25-33`
  - customer select and delivery terms in `transaction-detail.tsx:571-573, 676-680, 860`
  - Buying Guide `src/app/(customer)/buying-requirements/page.tsx:26-43`
  - landing page `src/app/(external)/page.tsx:262-269`
  - the error at `my-transactions/actions.ts:313`
  - seed `scripts/seed-data.cjs:961, 1059, 1074`

  > 2026-10-31: `my-transactions/actions.ts:313` is the transaction select after Phase 1 shifted line numbers; the
  > only payment-method error there (`:331`) already said Cash or Bank Transfer. Seed `payment_records` lines keep
  > `paymongo` on purpose: that is the channel. Only `purchase_details` drops it.
- [x] Update the existing tests:
  - unit: `buy-flow.test.ts`, `buy-request-phase4.test.ts`, `online-payment.test.ts`
  - e2e: `src/tests/e2e/t01-phase6-bank-transfer.spec.ts`, `src/tests/e2e/support/t01.ts:78-94`

  > 2026-10-31: unit files pass. The e2e files were edited but not run (no dev server and live QA is deferred). The
  > main agent must also update `src/tests/e2e/buying-revision-phase5.spec.ts:61,155`, which still matches the old
  > "Pay ₱... with PayMongo" button. That file is outside this phase's file list.

## Done when

- [x] Payment Method shows only Cash and Bank Transfer (via PayMongo). No PayMongo option anywhere for the buyer.
- [ ] A PayMongo test-mode checkout records verified rows for a Bank Transfer meet-up's downpayment and balance.

  > 2026-10-31: live QA deferred to main agent.
- [ ] Mark Sold is allowed after the balance is paid.

  > 2026-10-31: live QA deferred to main agent.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

  > 2026-10-31: repo-wide commands were not run (a sibling agent shares this worktree). Verified instead with
  > `npx tsc --noEmit` (clean) and `npx vitest run` on the six test files this phase touches (95 passed).
  > `npx biome check` is clean on every touched file except `scripts/seed-data.cjs`, which already had unrelated
  > lint errors before this phase.

---

## Live QA (2026-10-31, main agent)

- Payment Method offers exactly "Cash" and "Bank Transfer (via PayMongo)". No standalone PayMongo option.
- Payment Option offers "Full Payment" and "Financing", so financing stays an option.
- A Bank Transfer + Full Payment GCE Visit buy saved successfully; `purchase_details.payment_method = 'bank_transfer'`
  with `payment_option = 'full'`.
- Not live-tested: PayMongo test-mode checkout, webhook verification and the Mark Sold gate after the balance is paid.
  The seller side needs a transaction that has already cleared documents, and a webhook needs a signed replay or a
  tunnel; both are outstanding.

---

[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)
